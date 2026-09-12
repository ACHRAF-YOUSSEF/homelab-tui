import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { Box, useApp, useInput } from "./tui.js";
import { Monitor, PassphraseRequiredError } from "../core/monitor.js";
import { classifySSHError, type ConnectOptions } from "../transports/ssh.js";
import { getLatestRelease } from "../updater.js";
import { version as VERSION } from "../../package.json";
import {
  restartDockerService,
  startDockerService,
  stopDockerService,
} from "../adapters/docker.js";
import { stopNativeService } from "../adapters/native-actions.js";
import type { HostConfig, MonitorSnapshot, Service, ServiceStatus } from "../core/types.js";
import { Header } from "./Header.js";
import { SystemPanel } from "./SystemPanel.js";
import { ServiceList } from "./ServiceList.js";
import { ServiceDetails } from "./ServiceDetails.js";
import { LogPanel, splitLogChunk } from "./LogPanel.js";
import { Footer } from "./Footer.js";
import { getTerminalLayout } from "./geometry.js";
import { monitorKeys } from "./keys.js";

const REFRESH_MS = 3_000;
const MAX_LOG_LINES = 2000;
const RECONNECT_DELAYS = [3, 5, 10, 20, 30]; // seconds

export type SortField = "name" | "status" | "image";
export type StatusFilter = ServiceStatus | "all" | "docker" | "native";

const STATUS_FILTER_CYCLE: StatusFilter[] = ["all", "docker", "native", "running", "stopped", "failed", "restarting"];
const SORT_CYCLE: SortField[] = ["name", "status", "image"];

type Props = {
  hostConfig: HostConfig;
  connectOptions?: ConnectOptions;
  onSwitchHost: () => void;
  onNeedPassphrase: () => void;
};

export function App({ hostConfig, connectOptions, onSwitchHost, onNeedPassphrase }: Readonly<Props>) {
  const { exit } = useApp();
  const monitorRef = useRef<Monitor | null>(null);

  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reconnect
  const [retryKey, setRetryKey] = useState(0);
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Filter / sort / search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortField>("name");

  // Logs
  const [logsOpen, setLogsOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const logCancelRef = useRef<(() => void) | null>(null);

  // Actions
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Update check
  const [updateTag, setUpdateTag] = useState<string | null>(null);

  useEffect(() => {
    getLatestRelease()
      .then(({ tag }) => {
        // Only show if tag is strictly newer (tag format: "v1.2.3")
        if (tag !== `v${VERSION}`) setUpdateTag(tag);
      })
      .catch(() => {}); // silently ignore — no network / no release
  }, []);

  const allServices: Service[] = snapshot?.services ?? [];

  const filteredServices = useMemo(() => {
    let result = allServices;
    if (statusFilter === "docker") {
      result = result.filter((s) => s.kind === "docker-container" || s.kind === "docker-compose");
    } else if (statusFilter === "native") {
      result = result.filter((s) => s.kind === "system-service");
    } else if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.image?.toLowerCase().includes(q) ?? false)
      );
    }
    return [...result].sort((a, b) => {
      if (sortBy === "status") return a.status.localeCompare(b.status);
      if (sortBy === "image") return (a.image ?? "").localeCompare(b.image ?? "");
      return a.name.localeCompare(b.name);
    });
  }, [allServices, statusFilter, searchQuery, sortBy]);


  const clampedIndex = Math.min(selectedIndex, Math.max(0, filteredServices.length - 1));
  const selectedService: Service | null = filteredServices[clampedIndex] ?? null;

  // ── Reconnect logic ──────────────────────────────────────────────────────────
  const triggerReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return; // already counting down
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptsRef.current, RECONNECT_DELAYS.length - 1)];
    reconnectAttemptsRef.current++;
    let count = delay;
    setReconnectCountdown(count);
    reconnectTimerRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(reconnectTimerRef.current!);
        reconnectTimerRef.current = null;
        setReconnectCountdown(null);
        setRetryKey((k) => k + 1); // re-triggers the main connection useEffect
      } else {
        setReconnectCountdown(count);
      }
    }, 1000);
  }, []);

  // Watch for connection errors in snapshot
  useEffect(() => {
    if (snapshot?.error && classifySSHError(snapshot.error).retryable) {
      triggerReconnect();
    }
  }, [snapshot?.error, triggerReconnect]);

  // Clear reconnect state on successful snapshot
  useEffect(() => {
    if (snapshot && !snapshot.error) {
      reconnectAttemptsRef.current = 0;
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
        setReconnectCountdown(null);
      }
    }
  }, [snapshot]);

  // ── Live log stream ──────────────────────────────────────────────────────────
  useEffect(() => {
    logCancelRef.current?.();
    logCancelRef.current = null;
    if (!logsOpen || !selectedService) { setLogLines([]); return; }

    setLogLines([]);
    setLogsLoading(true);
    let buf: string[] = [];
    let remainder = "";
    const mon = monitorRef.current;
    if (!mon) return;

    mon.streamLogs(
      selectedService,
      (chunk) => {
        const next = splitLogChunk(remainder, chunk);
        remainder = next.remainder;
        buf = [...buf, ...next.lines].slice(-MAX_LOG_LINES);
        setLogLines(remainder ? [...buf, remainder] : [...buf]);
        setLogsLoading(false);
      },
      () => setLogsLoading(false)
    )
      .then((cancel) => { logCancelRef.current = cancel; })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setLogLines([`Error: ${msg}`]);
        setLogsLoading(false);
      });

    return () => { logCancelRef.current?.(); logCancelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedIndex, logsOpen]);

  const flash = (msg: string, isError = false) => {
    if (isError) setActionError(msg);
    else setActionMessage(msg);
    setTimeout(() => { setActionMessage(null); setActionError(null); }, 3_000);
  };

  const doRefresh = useCallback(async () => {
    const mon = monitorRef.current;
    if (!mon) return;
    try {
      const snap = await mon.refresh();
      setSnapshot(snap);
      setLastUpdated(new Date());
      setConnecting(false);
    } catch { setConnecting(false); }
  }, []);

  // ── Main connection effect — re-runs on host change OR retryKey increment ───
  useEffect(() => {
    const mon = new Monitor(hostConfig);
    monitorRef.current = mon;
    setConnecting(true);
    setSnapshot(null);

    mon.connect(connectOptions)
      .then(() => doRefresh())
      .catch((err: unknown) => {
        if (err instanceof PassphraseRequiredError) { onNeedPassphrase(); return; }
        const msg = err instanceof Error ? err.message : String(err);
        setSnapshot({
          hostName: hostConfig.name,
          remoteOS: "unknown",
          system: { hostname: hostConfig.host, os: "unknown" },
          services: [],
          error: `SSH connect failed: ${msg}`,
        });
        setConnecting(false);
      });

    const interval = setInterval(doRefresh, REFRESH_MS);
    return () => {
      clearInterval(interval);
      mon.dispose();
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [hostConfig, connectOptions, doRefresh, onNeedPassphrase, retryKey]);

  const runAction = useCallback(
    async (action: string, fn: () => Promise<void>) => {
      if (busy || !selectedService) return;
      setBusy(true);
      try {
        await fn();
        flash(`${action} ${selectedService.name} ok`);
        await doRefresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        flash(`${action} failed: ${msg}`, true);
      } finally { setBusy(false); }
    },
    [busy, selectedService, doRefresh]
  );

  const getRunner = () => (cmd: string) => monitorRef.current!.run(cmd);

  useInput((input, key) => {
    if (searchMode) {
      if (monitorKeys.cancel.matches(input, key)) { setSearchMode(false); setSearchQuery(""); setSelectedIndex(0); return; }
      if (!logsOpen) {
        if (monitorKeys.up.matches(input, key)) { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
        if (monitorKeys.down.matches(input, key)) { setSelectedIndex((i) => Math.min(filteredServices.length - 1, i + 1)); return; }
      }
      return;
    }

    if (monitorKeys.quit.matches(input, key)) { exit(); return; }
    if (monitorKeys.hosts.matches(input, key)) { onSwitchHost(); return; }

    if (!logsOpen) {
      if (monitorKeys.up.matches(input, key)) { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
      if (monitorKeys.down.matches(input, key)) { setSelectedIndex((i) => Math.min(filteredServices.length - 1, i + 1)); return; }
    }

    if (monitorKeys.search.matches(input, key)) { setSearchMode(true); return; }
    if (monitorKeys.filter.matches(input, key)) {
      setStatusFilter((cur) => {
        const idx = STATUS_FILTER_CYCLE.indexOf(cur);
        return STATUS_FILTER_CYCLE[(idx + 1) % STATUS_FILTER_CYCLE.length];
      });
      setSelectedIndex(0);
      return;
    }
    if (monitorKeys.sort.matches(input, key)) {
      setSortBy((cur) => {
        const idx = SORT_CYCLE.indexOf(cur);
        return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
      });
      setSelectedIndex(0);
      return;
    }

    if (!selectedService || busy) return;

    const run = getRunner();
    const os = snapshot?.remoteOS ?? "unknown";
    const isNative = selectedService.kind === "system-service";

    if (isNative) {
      // Discovered processes: only kill (stop) is supported
      if (monitorKeys.kill.matches(input, key)) runAction("kill", () => stopNativeService(run, selectedService, os));
      else if (monitorKeys.restart.matches(input, key) || monitorKeys.start.matches(input, key)) flash("Not available for discovered processes", true);
      else if (monitorKeys.logs.matches(input, key)) setLogsOpen((open) => !open);
    } else if (monitorKeys.restart.matches(input, key)) runAction("restart", () => restartDockerService(run, selectedService));
      else if (monitorKeys.stop.matches(input, key)) runAction("stop", () => stopDockerService(run, selectedService));
      else if (monitorKeys.start.matches(input, key)) runAction("start", () => startDockerService(run, selectedService));
      else if (monitorKeys.logs.matches(input, key)) setLogsOpen((open) => !open);
  });

  const error = snapshot?.error ?? actionError ?? null;
  const { width, height } = useTerminalDimensions();
  const layout = getTerminalLayout(width, height, 1, logsOpen);

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Header
        snapshot={snapshot}
        connecting={connecting}
        lastUpdated={lastUpdated}
        reconnectCountdown={reconnectCountdown}
        compact={layout.narrow}
        version={VERSION}
        updateTag={updateTag}
      />
      {!layout.compact && !logsOpen && snapshot?.system && <SystemPanel system={snapshot.system} compact={layout.narrow} />}
      <ServiceList
        services={filteredServices}
        allCount={allServices.length}
        selectedIndex={clampedIndex}
        searchQuery={searchQuery}
        searchMode={searchMode}
        statusFilter={statusFilter}
        sortBy={sortBy}
        filterKey={`${statusFilter}-${sortBy}-${searchQuery}`}
        containerWidth={layout.paneWidth}
        viewHeight={layout.serviceRows}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => { setSearchMode(false); setSelectedIndex(0); }}
      />
      <ServiceDetails service={selectedService} containerWidth={width} compact={layout.compact || logsOpen} />
      <LogPanel
        lines={logLines}
        loading={logsLoading}
        serviceName={selectedService?.name ?? null}
        visible={logsOpen}
        viewHeight={layout.logRows}
      />
      <Footer actionMessage={actionMessage} error={error} selectedKind={selectedService?.kind} />
    </Box>
  );
}
