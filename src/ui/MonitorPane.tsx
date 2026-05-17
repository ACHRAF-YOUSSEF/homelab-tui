import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { Monitor, PassphraseRequiredError } from "../core/monitor.js";
import type { ConnectOptions } from "../transports/ssh.js";
import type { HostConfig, MonitorSnapshot, Service } from "../core/types.js";
import { Header } from "./Header.js";
import { SystemPanel } from "./SystemPanel.js";
import { ServiceList } from "./ServiceList.js";
import type { SortField, StatusFilter } from "./App.js";

const REFRESH_MS = 3_000;
const RECONNECT_DELAYS = [3, 5, 10, 20, 30];
const STATUS_FILTER_CYCLE: StatusFilter[] = ["all", "docker", "native", "running", "stopped", "failed", "restarting"];
const SORT_CYCLE: SortField[] = ["name", "status", "image"];

function isConnectionError(msg: string): boolean {
  return /not connected|ssh not|econnreset|socket|connection (lost|closed|refused)|timed?\s?out/i.test(msg);
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
  version: string;
  updateTag?: string | null;
  containerWidth?: number;
  onNeedPassphrase?: () => void;
  onStateChange: (service: Service | null, snapshot: MonitorSnapshot | null) => void;
};

export const MonitorPane = forwardRef<MonitorPaneHandle, Props>(function MonitorPane(props, ref) {
  const { hostConfig, connectOptions, isActive, focused, version, updateTag,
    containerWidth, onNeedPassphrase, onStateChange } = props;

  const monitorRef = useRef<Monitor | null>(null);
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [retryKey, setRetryKey] = useState(0);
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);

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

  // Reconnect
  const triggerReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
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
        setRetryKey((k) => k + 1);
      } else setReconnectCountdown(count);
    }, 1000);
  }, []);

  useEffect(() => {
    if (snapshot?.error && isConnectionError(snapshot.error)) triggerReconnect();
  }, [snapshot?.error, triggerReconnect]);

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

  useEffect(() => {
    const mon = new Monitor(hostConfig);
    monitorRef.current = mon;
    setConnecting(true);
    setSnapshot(null);

    mon.connect(connectOptions)
      .then(() => doRefresh())
      .catch((err: unknown) => {
        if (err instanceof PassphraseRequiredError) { onNeedPassphrase?.(); return; }
        const msg = err instanceof Error ? err.message : String(err);
        setSnapshot({
          hostName: hostConfig.name, remoteOS: "unknown",
          system: { hostname: hostConfig.host, os: "unknown" },
          services: [], error: `SSH connect failed: ${msg}`,
        });
        setConnecting(false);
      });

    const interval = setInterval(doRefresh, REFRESH_MS);
    return () => {
      clearInterval(interval);
      mon.dispose();
      if (reconnectTimerRef.current) { clearInterval(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    };
  }, [hostConfig, connectOptions, doRefresh, onNeedPassphrase, retryKey]);

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

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={focused ? "cyan" : "gray"}>
      <Header
        snapshot={snapshot} connecting={connecting} lastUpdated={lastUpdated}
        reconnectCountdown={reconnectCountdown} version={version} updateTag={updateTag}
      />
      {snapshot?.system && <SystemPanel system={snapshot.system} />}
      <ServiceList
        services={filteredServices} allCount={allServices.length}
        selectedIndex={clampedIndex} searchQuery={searchQuery}
        searchMode={searchMode} statusFilter={statusFilter} sortBy={sortBy}
        filterKey={`${statusFilter}-${sortBy}-${searchQuery}`}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => { setSearchMode(false); setSelectedIndex(0); }}
        containerWidth={containerWidth}
      />
      {snapshot?.error && <Text color="red" wrap="truncate"> {snapshot.error}</Text>}
    </Box>
  );
});
