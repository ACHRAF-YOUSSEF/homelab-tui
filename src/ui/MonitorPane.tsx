import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { Monitor, PassphraseRequiredError } from "../core/monitor.js";
import type { ConnectOptions } from "../transports/ssh.js";
import type { HostConfig, MonitorSnapshot, Service, ServiceStatus, SystemInfo } from "../core/types.js";
import { Header } from "./Header.js";
import { SystemPanel } from "./SystemPanel.js";
import { ServiceList } from "./ServiceList.js";
import type { SortField, StatusFilter } from "./App.js";

// ── Compact metrics (used in multi-pane mode, no border) ────────────────────
function fmtBytes(b: number) {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)}G`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(0)}M`;
  return `${b}B`;
}
function clr(pct: number) { return pct > 80 ? "red" : pct > 50 ? "yellow" : "green"; }

function CompactMetrics({ system }: Readonly<{ system: SystemInfo }>) {
  const ramPct = system.ram
    ? Math.round((system.ram.usedBytes / system.ram.totalBytes) * 100) : null;
  return (
    <Box paddingX={1} gap={2} flexWrap="wrap">
      {system.cpuUsagePercent !== undefined && (
        <Box gap={1}>
          <Text dimColor>CPU</Text>
          <Text color={clr(system.cpuUsagePercent)}>{system.cpuUsagePercent}%</Text>
        </Box>
      )}
      {system.ram && ramPct !== null && (
        <Box gap={1}>
          <Text dimColor>RAM</Text>
          <Text color={clr(ramPct)}>{fmtBytes(system.ram.usedBytes)}/{fmtBytes(system.ram.totalBytes)}</Text>
        </Box>
      )}
      {(system.disks ?? []).slice(0, 3).map((d) => {
        const pct = Math.round(((d.totalBytes - d.freeBytes) / d.totalBytes) * 100);
        return (
          <Box key={d.name} gap={1}>
            <Text dimColor>{d.name}</Text>
            <Text color={clr(pct)}>{fmtBytes(d.totalBytes - d.freeBytes)}/{fmtBytes(d.totalBytes)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

const REFRESH_MS = 3_000;
const RECONNECT_DELAYS = [3, 5, 10, 20, 30];
const STATUS_FILTER_CYCLE: StatusFilter[] = ["all", "docker", "native", "running", "stopped", "failed", "restarting"];
const SORT_CYCLE: SortField[] = ["name", "status", "image"];

function isConnectionError(msg: string): boolean {
  return /not connected|ssh not|econnreset|socket|connection (lost|closed|refused)|timed?\s?out/i.test(msg);
}
function isAuthError(msg: string): boolean {
  return /all configured authentication methods failed|authentication failed|auth.*failed|permission denied|bad packet|incorrect passphrase|verification failed/i.test(msg);
}

export type MonitorPaneHandle = {
  run: (cmd: string) => Promise<string>;
  streamLogs: (
    service: Service,
    onData: (chunk: string) => void,
    onClose?: (code: number | null) => void
  ) => Promise<() => void>;
};

type Props = {
  hostConfig: HostConfig;
  connectOptions?: ConnectOptions;
  isActive: boolean;
  focused: boolean;
  paneIndex?: number;   // undefined → single-pane (full Header)
  paneCount?: number;
  version: string;
  updateTag?: string | null;
  containerWidth?: number;
  onNeedPassphrase?: () => void;
  onAuthFailed?: (msg: string) => void;
  onStateChange: (service: Service | null, snapshot: MonitorSnapshot | null) => void;
};

export const MonitorPane = forwardRef<MonitorPaneHandle, Props>(function MonitorPane(props, ref) {
  const { hostConfig, connectOptions, isActive, focused, paneIndex, paneCount,
    containerWidth, onNeedPassphrase, onAuthFailed, onStateChange } = props;
  const multiPane = (paneCount ?? 1) > 1;

  const monitorRef = useRef<Monitor | null>(null);
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const [downAlert, setDownAlert] = useState<string | null>(null);
  const downAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevServicesRef = useRef<Map<string, ServiceStatus>>(new Map());

  // Stable refs so callbacks don't go stale inside timers / counters
  const connectOptionsRef = useRef(connectOptions);
  connectOptionsRef.current = connectOptions;
  const hostConfigRef = useRef(hostConfig);
  hostConfigRef.current = hostConfig;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortField>("name");

  const allServices: Service[] = snapshot?.services ?? [];

  const filteredServices = useMemo(() => {
    let result = allServices;
    if (statusFilter === "docker") result = result.filter((s) => s.kind === "docker-container" || s.kind === "docker-compose");
    else if (statusFilter === "native") result = result.filter((s) => s.kind === "system-service");
    else if (statusFilter !== "all") result = result.filter((s) => s.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || (s.image?.toLowerCase().includes(q) ?? false));
    }
    return [...result].sort((a, b) => {
      if (sortBy === "status") return a.status.localeCompare(b.status);
      if (sortBy === "image") return (a.image ?? "").localeCompare(b.image ?? "");
      return a.name.localeCompare(b.name);
    });
  }, [allServices, statusFilter, searchQuery, sortBy]);

  const clampedIndex = Math.min(selectedIndex, Math.max(0, filteredServices.length - 1));
  const selectedService = filteredServices[clampedIndex] ?? null;

  // Report state upward — use a ref so the effect never goes stale on callback identity changes
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  useEffect(() => {
    onStateChangeRef.current(selectedService, snapshot);
  }, [selectedService, snapshot]);

  const doRefreshRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Reuse Monitor instance — no React teardown, just reconnect transport
  const triggerReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    const attempt = reconnectAttemptsRef.current;
    const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
    reconnectAttemptsRef.current++;
    setReconnectAttempt(reconnectAttemptsRef.current);
    let count = delay;
    setReconnectCountdown(count);
    setConnecting(true);
    reconnectTimerRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(reconnectTimerRef.current!);
        reconnectTimerRef.current = null;
        setReconnectCountdown(null);
        monitorRef.current?.reconnect(connectOptionsRef.current ?? {})
          .then(() => doRefreshRef.current())
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            const cfg = hostConfigRef.current;
            setSnapshot({
              hostName: cfg.name, remoteOS: "unknown",
              system: { hostname: cfg.host, os: "unknown" },
              services: [], error: msg,
            });
            setConnecting(false);
          });
      } else setReconnectCountdown(count);
    }, 1000);
  }, []);

  useEffect(() => {
    if (snapshot?.error && isConnectionError(snapshot.error)) triggerReconnect();
  }, [snapshot?.error, triggerReconnect]);

  useEffect(() => {
    if (snapshot && !snapshot.error) {
      reconnectAttemptsRef.current = 0;
      setReconnectAttempt(0);
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
        setReconnectCountdown(null);
      }
    }
  }, [snapshot]);

  // Service-down alerts: detect running → stopped/failed transitions
  useEffect(() => {
    if (!snapshot || snapshot.error) return;
    const prev = prevServicesRef.current;
    const alerts: string[] = [];
    for (const svc of snapshot.services) {
      const prevStatus = prev.get(svc.id);
      if (prevStatus === "running" && (svc.status === "stopped" || svc.status === "failed")) {
        alerts.push(`${svc.name} ↓ ${svc.status}`);
      }
    }
    prevServicesRef.current = new Map(snapshot.services.map((s) => [s.id, s.status]));
    if (alerts.length === 0) return;
    process.stdout.write(""); // terminal bell
    const msg = alerts.join("  ·  ");
    setDownAlert(msg);
    if (downAlertTimerRef.current) clearTimeout(downAlertTimerRef.current);
    downAlertTimerRef.current = setTimeout(() => setDownAlert(null), 10_000);
  }, [snapshot]);

  // Stable ref so onNeedPassphrase never enters the connection useEffect dep array
  const onNeedPassphraseRef = useRef(onNeedPassphrase);
  onNeedPassphraseRef.current = onNeedPassphrase;
  const onAuthFailedRef = useRef(onAuthFailed);
  onAuthFailedRef.current = onAuthFailed;

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
  doRefreshRef.current = doRefresh;

  useEffect(() => {
    const mon = new Monitor(hostConfig, triggerReconnect);
    monitorRef.current = mon;
    setConnecting(true);
    setSnapshot(null);

    mon.connect(connectOptions)
      .then(() => doRefresh())
      .catch((err: unknown) => {
        if (err instanceof PassphraseRequiredError) { onNeedPassphraseRef.current?.(); return; }
        const msg = err instanceof Error ? err.message : String(err);
        if (isAuthError(msg) && onAuthFailedRef.current) {
          onAuthFailedRef.current(msg);
          return;
        }
        setSnapshot({
          hostName: hostConfig.name, remoteOS: "unknown",
          system: { hostname: hostConfig.host, os: "unknown" },
          services: [], error: `SSH connect failed: ${msg}`,
        });
        setConnecting(false);
      });

    const refreshMs = hostConfig.refreshInterval ?? REFRESH_MS;
    const interval = setInterval(doRefresh, refreshMs);
    return () => {
      clearInterval(interval);
      mon.dispose();
      if (reconnectTimerRef.current) { clearInterval(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    };
  }, [hostConfig, connectOptions, doRefresh]); // onNeedPassphrase/retryKey intentionally excluded (refs above)

  useImperativeHandle(ref, () => ({
    run: (cmd) => monitorRef.current!.run(cmd),
    streamLogs: (service, onData, onClose) => monitorRef.current!.streamLogs(service, onData, onClose),
  }), []);

  useInput((input, key) => {
    if (searchMode) {
      if (key.escape) { setSearchMode(false); setSearchQuery(""); setSelectedIndex(0); return; }
      if (key.upArrow) { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setSelectedIndex((i) => Math.min(filteredServices.length - 1, i + 1)); return; }
      return;
    }
    if (key.upArrow) { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setSelectedIndex((i) => Math.min(filteredServices.length - 1, i + 1)); return; }
    if (input === "/") { setSearchMode(true); return; }
    if (input === "f") {
      setStatusFilter((cur) => STATUS_FILTER_CYCLE[(STATUS_FILTER_CYCLE.indexOf(cur) + 1) % STATUS_FILTER_CYCLE.length]);
      setSelectedIndex(0);
    }
    if (input === "o") {
      setSortBy((cur) => SORT_CYCLE[(SORT_CYCLE.indexOf(cur) + 1) % SORT_CYCLE.length]);
      setSelectedIndex(0);
    }
  }, { isActive });

  const serviceList = (
    <ServiceList
      services={filteredServices} allCount={allServices.length}
      selectedIndex={clampedIndex} searchQuery={searchQuery}
      searchMode={searchMode} statusFilter={statusFilter} sortBy={sortBy}
      filterKey={`${statusFilter}-${sortBy}-${searchQuery}`}
      onSearchChange={setSearchQuery}
      onSearchSubmit={() => { setSearchMode(false); setSelectedIndex(0); }}
      containerWidth={containerWidth}
    />
  );

  // ── Multi-pane compact layout ────────────────────────────────────────────
  if (multiPane) {
    const time = lastUpdated
      ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—";
    const borderColor = focused ? "cyan" : "gray";

    return (
      <Box flexDirection="column" flexGrow={1}
        borderStyle={focused ? "double" : "single"}
        borderColor={borderColor}>

        {/* Compact pane header — no nested border */}
        <Box paddingX={1} gap={1} flexWrap="nowrap">
          <Text bold color={focused ? "cyan" : "gray"}>[{(paneIndex ?? 0) + 1}]</Text>
          <Text bold color={focused ? "white" : "gray"}>{hostConfig.name}</Text>
          {snapshot && !connecting ? (
            <>
              <Text color="green">●</Text>
              <Text dimColor>{snapshot.remoteOS}</Text>
              <Text dimColor>{snapshot.system.hostname}</Text>
            </>
          ) : (
            <Text color="yellow">○ {connecting ? "connecting…" : "—"}</Text>
          )}
          {snapshot?.error && <Text color="red" wrap="truncate">✗ {snapshot.error}</Text>}
          <Box flexGrow={1} />
          {reconnectCountdown === null
            ? <Text dimColor>{time}</Text>
            : <Text color="yellow">reconnect {reconnectCountdown}s (#{reconnectAttempt})</Text>}
        </Box>

        {downAlert && (
          <Box paddingX={1}>
            <Text color="red" bold>⚠ {downAlert}</Text>
          </Box>
        )}

        {/* Compact inline metrics — no border */}
        {snapshot?.system && <CompactMetrics system={snapshot.system} />}

        {serviceList}
      </Box>
    );
  }

  // ── Single-pane full layout ──────────────────────────────────────────────
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="cyan">
      <Header
        snapshot={snapshot} connecting={connecting} lastUpdated={lastUpdated}
        reconnectCountdown={reconnectCountdown} reconnectAttempt={reconnectAttempt}
      />
      {snapshot?.system && <SystemPanel system={snapshot.system} />}
      {downAlert && (
        <Box paddingX={1}>
          <Text color="red" bold>⚠ {downAlert}</Text>
        </Box>
      )}
      {serviceList}
      {snapshot?.error && <Text color="red" wrap="truncate"> {snapshot.error}</Text>}
    </Box>
  );
});
