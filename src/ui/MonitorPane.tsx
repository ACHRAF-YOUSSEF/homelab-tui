import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Box, Text, TextInput, useInput } from "./tui.js";
import { Monitor, PassphraseRequiredError } from "../core/monitor.js";
import { classifySSHError, SSHConnectionError, type ConnectOptions, type RemoteShell, type ShellSize } from "../transports/ssh.js";
import type { HostConfig, MonitorSnapshot, Service, ServiceStatus } from "../core/types.js";
import { Header } from "./Header.js";
import { SystemPanel } from "./SystemPanel.js";
import { ServiceList } from "./ServiceList.js";
import type { SortField, StatusFilter } from "./App.js";
import { monitorKeys } from "./keys.js";
import { palette } from "./palette.js";

export type PaneConnectionState =
  | { status: "connecting" }
  | { status: "online" }
  | { status: "disconnected"; issue: SSHConnectionError }
  | { status: "retrying"; issue: SSHConnectionError; attempt: number; countdown: number }
  | { status: "needs-credential"; issue: SSHConnectionError; credential: "password" | "passphrase"; promptError?: string }
  | { status: "offline"; issue: SSHConnectionError };

export type PaneCredentialPrompt = {
  mode: "password" | "passphrase";
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

type InputHandler = Parameters<typeof useInput>[0];

function ActiveInput({ onInput }: Readonly<{ onInput: InputHandler }>) {
  useInput(onInput);
  return null;
}

export function canRetryConnection(connection: PaneConnectionState): boolean {
  return connection.status === "disconnected"
    || connection.status === "retrying"
    || (connection.status === "offline" && !["host-key", "key-file"].includes(connection.issue.kind));
}

function describeIssue(host: HostConfig, issue: SSHConnectionError) {
  switch (issue.kind) {
    case "authentication":
      return {
        title: "Authentication failed",
        detail: `Credentials rejected for ${host.username}@${host.name}.`,
        help: host.authMethod === "password"
          ? "Re-enter the SSH password."
          : "Check the private key and the remote authorized_keys file.",
      };
    case "refused":
      return {
        title: "SSH connection refused",
        detail: `${host.host}:${host.port} refused the connection.`,
        help: "SSH may be stopped or disabled, the port may be wrong, or a firewall may be rejecting it.",
      };
    case "timeout":
      return { title: "Connection timed out", detail: `Could not reach ${host.host}:${host.port}.`, help: "Check that the host is online and reachable." };
    case "host-not-found":
      return { title: "Host not found", detail: `Could not resolve ${host.host}.`, help: "Check the configured hostname or DNS." };
    case "unreachable":
      return { title: "Host unreachable", detail: `No route to ${host.host}:${host.port}.`, help: "Check the network, VPN, and firewall rules." };
    case "host-key":
      return { title: "Host identity rejected", detail: "The SSH host key could not be verified.", help: "Verify the host identity before changing any trusted key." };
    case "key-file":
      return { title: "Private key unavailable", detail: issue.message, help: "Return to Hosts and correct the private-key path or permissions." };
    case "disconnected":
      return { title: "Connection lost", detail: `${host.name} stopped responding.`, help: "r reconnect · x disconnect and close tab" };
    default:
      return { title: "SSH connection failed", detail: issue.message, help: "Check the host settings, then retry." };
  }
}

function ConnectionPanel({ host, snapshot, lastUpdated, connection, compact }: Readonly<{
  host: HostConfig;
  snapshot: MonitorSnapshot | null;
  lastUpdated: Date | null;
  connection: PaneConnectionState;
  compact?: boolean;
}>) {
  if (connection.status === "connecting" || connection.status === "online") {
    return (
      <Box borderStyle="single" borderColor={palette.warning} paddingX={1} width="100%" flexDirection="column">
        <Text bold color={palette.warning}>○ Connecting</Text>
        <Text dimColor>{host.username}@{host.host}:{host.port}</Text>
      </Box>
    );
  }

  const { title, detail, help } = connection.status === "needs-credential" && connection.credential === "passphrase"
    ? {
        title: connection.promptError ? "Passphrase rejected" : "Passphrase required",
        detail: `Unlock the private key for ${host.username}@${host.name}.`,
        help: "Enter the key passphrase; it is used only for this session.",
      }
    : describeIssue(host, connection.issue);
  const retrying = connection.status === "retrying";
  const color = retrying ? palette.warning : palette.danger;

  return (
    <Box borderStyle="single" borderColor={color} paddingX={1} width="100%" flexDirection="column">
      <Text bold color={color}>{retrying ? "↻" : "✗"} {title}</Text>
      {retrying && <Text color={palette.warning}>Retry #{connection.attempt} in {connection.countdown}s</Text>}
      <Text dimColor wrap="truncate">{detail}</Text>
      {!compact && <Text dimColor wrap="truncate">{help}</Text>}
      {snapshot && lastUpdated && (
        <Text dimColor>Last good update {lastUpdated.toLocaleTimeString()} · {snapshot.services.length} services (stale)</Text>
      )}
    </Box>
  );
}

function CredentialEditor({ host, prompt }: Readonly<{ host: HostConfig; prompt: PaneCredentialPrompt }>) {
  const label = prompt.mode === "password" ? "Password" : "Passphrase";
  return (
    <Box borderStyle="single" borderColor={prompt.error ? palette.danger : palette.warning} paddingX={1} flexDirection="column">
      {prompt.error && <Text color={palette.danger} wrap="truncate">{prompt.error}</Text>}
      <Box>
        <Text color={prompt.error ? palette.danger : palette.warning}>{label} for {host.name}: </Text>
        <TextInput value={prompt.value} onChange={prompt.onChange} onSubmit={prompt.onSubmit} mask="*" focus />
      </Box>
      <Text dimColor><Text color={palette.structure}>Enter</Text> connect · <Text color={palette.structure}>Esc</Text> cancel</Text>
    </Box>
  );
}

const REFRESH_MS = 3_000;
const RECONNECT_DELAYS = [3, 5, 10, 20, 30];
const STATUS_FILTER_CYCLE: StatusFilter[] = ["all", "docker", "native", "running", "stopped", "failed", "restarting"];
const SORT_CYCLE: SortField[] = ["name", "status", "image"];

export type MonitorPaneHandle = {
  run: (cmd: string) => Promise<string>;
  openShell: (
    size: ShellSize,
    onData: (chunk: Uint8Array) => void,
    onClose?: (error?: Error) => void,
  ) => Promise<RemoteShell>;
  streamLogs: (
    service: Service,
    onData: (chunk: string) => void,
    onClose?: (code: number | null) => void
  ) => Promise<() => void>;
  retry: () => void;
  requestCredential: () => void;
};

type Props = {
  hostConfig: HostConfig;
  connectOptions?: ConnectOptions;
  isActive: boolean;
  paneCount?: number;
  containerWidth?: number;
  viewHeight?: number;
  compact?: boolean;
  credentialPrompt?: PaneCredentialPrompt;
  onCredentialNeeded?: (mode: "password" | "passphrase", error?: string) => void;
  onStateChange: (service: Service | null, snapshot: MonitorSnapshot | null, connection: PaneConnectionState) => void;
};

export const MonitorPane = forwardRef<MonitorPaneHandle, Props>(function MonitorPane(props, ref) {
  const { hostConfig, connectOptions, isActive, paneCount,
    containerWidth, viewHeight, compact, credentialPrompt, onCredentialNeeded, onStateChange } = props;
  const multiPane = (paneCount ?? 1) > 1;

  const monitorRef = useRef<Monitor | null>(null);
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [connection, setConnection] = useState<PaneConnectionState>({ status: "connecting" });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const reconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const refreshGenerationRef = useRef(0);
  const refreshInFlightRef = useRef<number | null>(null);

  const [downAlert, setDownAlert] = useState<string | null>(null);
  const downAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevServicesRef = useRef<Map<string, ServiceStatus>>(new Map());

  // Stable refs so callbacks don't go stale inside timers / counters
  const connectOptionsRef = useRef(connectOptions);
  connectOptionsRef.current = connectOptions;
  const hostConfigRef = useRef(hostConfig);
  hostConfigRef.current = hostConfig;
  const connectionRef = useRef(connection);
  connectionRef.current = connection;

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
    onStateChangeRef.current(connection.status === "online" ? selectedService : null, snapshot, connection);
  }, [selectedService, snapshot, connection]);

  const doRefreshRef = useRef<(force?: boolean) => Promise<void>>(() => Promise.resolve());
  const handleFailureRef = useRef<(err: unknown, allowCredentialPrompt?: boolean) => void>(() => {});

  const onCredentialNeededRef = useRef(onCredentialNeeded);
  onCredentialNeededRef.current = onCredentialNeeded;

  const clearReconnectTimer = useCallback(() => {
    if (!reconnectTimerRef.current) return;
    clearInterval(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const reconnectNow = useCallback(() => {
    const mon = monitorRef.current;
    if (!mon) return;
    clearReconnectTimer();
    refreshGenerationRef.current++;
    setConnection({ status: "connecting" });
    mon.reconnect(connectOptionsRef.current ?? {})
      .then(() => doRefreshRef.current(true))
      .catch((err: unknown) => handleFailureRef.current(err, true));
  }, [clearReconnectTimer]);

  const scheduleReconnect = useCallback((issue: SSHConnectionError) => {
    if (reconnectTimerRef.current) return;
    const attempt = ++reconnectAttemptsRef.current;
    let countdown = RECONNECT_DELAYS[Math.min(attempt - 1, RECONNECT_DELAYS.length - 1)];
    setConnection({ status: "retrying", issue, attempt, countdown });
    reconnectTimerRef.current = setInterval(() => {
      countdown--;
      if (countdown <= 0) reconnectNow();
      else setConnection({ status: "retrying", issue, attempt, countdown });
    }, 1000);
  }, [reconnectNow]);

  const handleFailure = useCallback((err: unknown, allowCredentialPrompt = false) => {
    if (allowCredentialPrompt && err instanceof PassphraseRequiredError) {
      const issue = new SSHConnectionError("authentication", err.message, false);
      const promptError = connectOptionsRef.current?.passphrase ? err.message : undefined;
      setConnection({ status: "needs-credential", issue, credential: "passphrase", promptError });
      if (!multiPane) onCredentialNeededRef.current?.("passphrase", promptError);
      return;
    }

    let issue = classifySSHError(err);
    if (!allowCredentialPrompt && issue.kind === "authentication") {
      issue = new SSHConnectionError("unknown", issue.message, false);
    }
    if (allowCredentialPrompt && issue.kind === "authentication" && hostConfigRef.current.authMethod === "password") {
      const promptError = "Credentials rejected. Re-enter the SSH password.";
      setConnection({ status: "needs-credential", issue, credential: "password", promptError });
      if (!multiPane) onCredentialNeededRef.current?.("password", promptError);
    } else if (!allowCredentialPrompt && connectionRef.current.status === "online" && issue.retryable) {
      clearReconnectTimer();
      refreshGenerationRef.current++;
      setConnection({
        status: "disconnected",
        issue: issue.kind === "disconnected"
          ? issue
          : new SSHConnectionError("disconnected", issue.message, true),
      });
    } else if (issue.retryable) {
      scheduleReconnect(issue);
    } else {
      setConnection({ status: "offline", issue });
    }
  }, [clearReconnectTimer, scheduleReconnect, multiPane]);
  handleFailureRef.current = handleFailure;

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

  const doRefresh = useCallback(async (force = false) => {
    const mon = monitorRef.current;
    if (!mon || (!force && connectionRef.current.status !== "online")) return;
    const generation = refreshGenerationRef.current;
    if (refreshInFlightRef.current === generation) return;
    refreshInFlightRef.current = generation;
    try {
      const snap = await mon.refresh();
      if (generation !== refreshGenerationRef.current || mon !== monitorRef.current) return;
      if (snap.error) {
        handleFailureRef.current(snap.error);
        return;
      }
      clearReconnectTimer();
      reconnectAttemptsRef.current = 0;
      setSnapshot(snap);
      setLastUpdated(new Date());
      setConnection({ status: "online" });
    } catch (err: unknown) {
      if (generation === refreshGenerationRef.current && mon === monitorRef.current) {
        handleFailureRef.current(err);
      }
    } finally {
      if (refreshInFlightRef.current === generation) refreshInFlightRef.current = null;
    }
  }, [clearReconnectTimer]);
  doRefreshRef.current = doRefresh;

  useEffect(() => {
    let active = true;
    refreshGenerationRef.current++;
    refreshInFlightRef.current = null;
    const mon = new Monitor(hostConfig, () => {
      if (active) handleFailureRef.current(new SSHConnectionError("disconnected", "Connection lost", true));
    });
    monitorRef.current = mon;
    setConnection({ status: "connecting" });

    mon.connect(connectOptions)
      .then(() => { if (active) return doRefresh(true); })
      .catch((err: unknown) => { if (active) handleFailureRef.current(err, true); });

    const refreshMs = hostConfig.refreshInterval ?? REFRESH_MS;
    const interval = setInterval(doRefresh, refreshMs);
    return () => {
      active = false;
      refreshGenerationRef.current++;
      refreshInFlightRef.current = null;
      clearInterval(interval);
      mon.dispose();
      clearReconnectTimer();
    };
  }, [hostConfig, connectOptions, doRefresh, clearReconnectTimer]);

  useImperativeHandle(ref, () => ({
    run: (cmd) => monitorRef.current!.run(cmd),
    openShell: (size, onData, onClose) => monitorRef.current!.openShell(size, onData, onClose),
    streamLogs: (service, onData, onClose) => monitorRef.current!.streamLogs(service, onData, onClose),
    retry: () => { if (canRetryConnection(connectionRef.current)) reconnectNow(); },
    requestCredential: () => {
      const current = connectionRef.current;
      if (current.status === "needs-credential") {
        onCredentialNeededRef.current?.(current.credential, current.promptError);
      }
    },
  }), [reconnectNow]);

  const handleInput: InputHandler = (input, key) => {
    if (connection.status !== "online") return;
    if (searchMode) {
      if (monitorKeys.cancel.matches(input, key)) { setSearchMode(false); setSearchQuery(""); setSelectedIndex(0); return; }
      if (monitorKeys.up.matches(input, key)) { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
      if (monitorKeys.down.matches(input, key)) { setSelectedIndex((i) => Math.min(filteredServices.length - 1, i + 1)); return; }
      return;
    }
    if (monitorKeys.up.matches(input, key)) { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
    if (monitorKeys.down.matches(input, key)) { setSelectedIndex((i) => Math.min(filteredServices.length - 1, i + 1)); return; }
    if (monitorKeys.search.matches(input, key)) { setSearchMode(true); return; }
    if (monitorKeys.filter.matches(input, key)) {
      setStatusFilter((cur) => STATUS_FILTER_CYCLE[(STATUS_FILTER_CYCLE.indexOf(cur) + 1) % STATUS_FILTER_CYCLE.length]);
      setSelectedIndex(0);
    }
    if (monitorKeys.sort.matches(input, key)) {
      setSortBy((cur) => SORT_CYCLE[(SORT_CYCLE.indexOf(cur) + 1) % SORT_CYCLE.length]);
      setSelectedIndex(0);
    }
  };

  const serviceList = (
    <ServiceList
      services={filteredServices} allCount={allServices.length}
      selectedIndex={clampedIndex} searchQuery={searchQuery}
      searchMode={searchMode} statusFilter={statusFilter} sortBy={sortBy}
      filterKey={`${statusFilter}-${sortBy}-${searchQuery}`}
      onSearchChange={setSearchQuery}
      onSearchSubmit={() => { setSearchMode(false); setSelectedIndex(0); }}
      containerWidth={containerWidth}
      viewHeight={viewHeight}
      emptyMessage={allServices.length === 0 ? "No services discovered on this host." : "No services match the current filter."}
    />
  );
  const content = connection.status === "online" && snapshot
    ? serviceList
    : <ConnectionPanel host={hostConfig} snapshot={snapshot} lastUpdated={lastUpdated} connection={connection} compact={compact} />;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {isActive && <ActiveInput onInput={handleInput} />}
      <Header
        snapshot={snapshot} connecting={connection.status === "connecting"} lastUpdated={lastUpdated}
        reconnectCountdown={connection.status === "retrying" ? connection.countdown : null}
        reconnectAttempt={connection.status === "retrying" ? connection.attempt : undefined}
        compact={(containerWidth ?? 80) < 120}
      />
      {!compact && connection.status === "online" && snapshot?.system && (
        <SystemPanel system={snapshot.system} compact={(containerWidth ?? 80) < 160} containerWidth={containerWidth} />
      )}
      {downAlert && (
        <Box paddingX={1}>
          <Text color={palette.danger} bold>⚠ {downAlert}</Text>
        </Box>
      )}
      {content}
      {credentialPrompt && <CredentialEditor host={hostConfig} prompt={credentialPrompt} />}
    </Box>
  );
});
