import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { Box, Text, TextInput, useApp, useInput } from "./tui.js";
import { MonitorPane, canRetryConnection } from "./MonitorPane.js";
import type { MonitorPaneHandle, PaneConnectionState } from "./MonitorPane.js";
import { ServiceDetails } from "./ServiceDetails.js";
import { LogPanel, splitLogChunk } from "./LogPanel.js";
import { Footer } from "./Footer.js";
import {
  restartDockerService,
  restartDockerStack,
  startDockerService,
  stopDockerService,
} from "../adapters/docker.js";
import { stopNativeService, restartNativeService } from "../adapters/native-actions.js";
import { getLatestRelease, isNewerVersion } from "../updater.js";
import { version as VERSION } from "../../package.json";
import type { ConnectOptions } from "../transports/ssh.js";
import type { HostConfig, MonitorSnapshot, Service, ServiceStatus, StatusChange } from "../core/types.js";
import { getTerminalLayout, getVisibleTabIndexes } from "./geometry.js";
import { monitorKeys } from "./keys.js";
import { palette } from "./palette.js";

const MAX_LOG_LINES = 2000;
const MAX_HISTORY = 5;

type PaneState = {
  service: Service | null;
  snapshot: MonitorSnapshot | null;
  connection: PaneConnectionState;
  history: Map<string, StatusChange[]>;
};

function mergeHistory(
  prev: Map<string, StatusChange[]>,
  oldSnap: MonitorSnapshot | null,
  newSnap: MonitorSnapshot | null,
): Map<string, StatusChange[]> {
  if (!newSnap || newSnap.error) return prev;
  const next = new Map(prev);
  for (const svc of newSnap.services) {
    const old = oldSnap?.services.find((s) => s.id === svc.id);
    if (!old || old.status === svc.status) continue;
    const existing = next.get(svc.id) ?? [];
    next.set(svc.id, [...existing, { status: svc.status as ServiceStatus, at: new Date() }].slice(-MAX_HISTORY));
  }
  return next;
}
type Mode = "normal" | "picking" | "new-password" | "credential" | "compose-restart";

type Props = {
  initialHosts: HostConfig[];
  initialConnectOptions: (ConnectOptions | undefined)[];
  allHosts: HostConfig[];       // all configured hosts (for the add-host picker)
  onSwitchHost: () => void;
};

export function MultiMonitor({ initialHosts, initialConnectOptions, allHosts, onSwitchHost }: Readonly<Props>) {
  const { exit } = useApp();
  const { width: columns, height: rows } = useTerminalDimensions();
  const terminalSize = { columns, rows };

  // Dynamic pane list — grows/shrinks as user adds/removes panes
  const [hosts, setHosts] = useState<HostConfig[]>(initialHosts);
  const [connectOpts, setConnectOpts] = useState<(ConnectOptions | undefined)[]>(initialConnectOptions);
  const [paneStates, setPaneStates] = useState<PaneState[]>(
    () => initialHosts.map(() => ({ service: null, snapshot: null, connection: { status: "connecting" }, history: new Map() }))
  );
  const [focusedPane, setFocusedPane] = useState(0);

  // Pane refs keyed by "host:port" so indices stay stable across add/remove
  const paneRefsMap = useRef<Map<string, MonitorPaneHandle | null>>(new Map());
  const paneKey = (h: HostConfig) => `${h.host}:${h.port}`;

  // Overlay mode
  const [mode, setMode] = useState<Mode>("normal");
  const [pickerIdx, setPickerIdx] = useState(0);
  const [credentialValue, setCredentialValue] = useState("");
  const [pendingHost, setPendingHost] = useState<HostConfig | null>(null);
  const [credentialPane, setCredentialPane] = useState(-1);
  const [credentialKind, setCredentialKind] = useState<"password" | "passphrase">("password");
  const [credentialError, setCredentialError] = useState<string | undefined>();

  // Logs
  const [logsOpen, setLogsOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const logCancelRef = useRef<(() => void) | null>(null);

  // Actions
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Update check (once)
  const [updateTag, setUpdateTag] = useState<string | null>(null);
  useEffect(() => {
    getLatestRelease()
      .then(({ tag }) => { if (isNewerVersion(tag, VERSION)) setUpdateTag(tag); })
      .catch(() => {});
  }, []);

  const focused = paneStates[focusedPane] ?? {
    service: null,
    snapshot: null,
    connection: { status: "connecting" } as PaneConnectionState,
    history: new Map<string, StatusChange[]>(),
  };
  const selectedService = focused.connection.status === "online" ? focused.service : null;
  const os = focused.snapshot?.remoteOS ?? "unknown";

  // Hosts not yet open (candidates for the picker)
  const availableHosts = allHosts.filter(
    (h) => !hosts.some((ah) => ah.host === h.host && ah.port === h.port)
  );

  const flash = (msg: string, isError = false) => {
    if (isError) setActionError(msg);
    else setActionMessage(msg);
    setTimeout(() => { setActionMessage(null); setActionError(null); }, 3_000);
  };

  // ── Add / remove panes ────────────────────────────────────────────────────
  const addPane = useCallback((host: HostConfig, opts?: ConnectOptions) => {
    setHosts((prev) => [...prev, host]);
    setConnectOpts((prev) => [...prev, opts]);
    setPaneStates((prev) => [...prev, { service: null, snapshot: null, connection: { status: "connecting" }, history: new Map() }]);
    setFocusedPane((prev) => prev + 1); // focus the new pane (it will be last)
    setMode("normal");
    setCredentialValue("");
    setPendingHost(null);
  }, []);

  const removePane = useCallback((idx: number) => {
    if (hosts.length <= 1) return;
    paneRefsMap.current.delete(paneKey(hosts[idx]));
    setHosts((prev) => prev.filter((_, i) => i !== idx));
    setConnectOpts((prev) => prev.filter((_, i) => i !== idx));
    setPaneStates((prev) => prev.filter((_, i) => i !== idx));
    setFocusedPane((prev) => Math.min(prev, hosts.length - 2));
  }, [hosts]);

  const swapPane = useCallback((fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= hosts.length) return;
    const swap = <T,>(arr: T[]): T[] => {
      const next = [...arr];
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      return next;
    };
    setHosts(swap);
    setConnectOpts(swap);
    setPaneStates(swap);
    setFocusedPane(toIdx); // focus follows the moved pane
  }, [hosts.length]);

  // ── Log streaming ─────────────────────────────────────────────────────────
  useEffect(() => {
    logCancelRef.current?.();
    logCancelRef.current = null;
    if (!logsOpen || !selectedService) { setLogLines([]); return; }

    setLogLines([]);
    setLogsLoading(true);
    let buf: string[] = [];
    let remainder = "";
    const pane = paneRefsMap.current.get(paneKey(hosts[focusedPane]));
    if (!pane) return;

    pane.streamLogs(
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
        setLogLines([`Error: ${err instanceof Error ? err.message : String(err)}`]);
        setLogsLoading(false);
      });

    return () => { logCancelRef.current?.(); logCancelRef.current = null; };
  }, [focusedPane, selectedService?.id, logsOpen, hosts]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const runAction = useCallback(async (action: string, fn: () => Promise<void>) => {
    if (busy || !selectedService) return;
    setBusy(true);
    try {
      await fn();
      flash(`${action} ${selectedService.name} ok`);
    } catch (err: unknown) {
      flash(`${action} failed: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally { setBusy(false); }
  }, [busy, selectedService]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useInput((input, key) => {
    // ── Picker mode ──
    if (mode === "picking") {
      if (monitorKeys.up.matches(input, key))   { setPickerIdx((i) => Math.max(0, i - 1)); return; }
      if (monitorKeys.down.matches(input, key)) { setPickerIdx((i) => Math.min(availableHosts.length - 1, i + 1)); return; }
      if (monitorKeys.cancel.matches(input, key)) { setMode("normal"); return; }
      if (monitorKeys.confirm.matches(input, key) && availableHosts.length > 0) {
        const host = availableHosts[pickerIdx];
        if (host.authMethod === "password") {
          setPendingHost(host);
          setCredentialValue("");
          setMode("new-password");
        } else {
          addPane(host);
        }
      }
      return;
    }

    // ── Credential modes ──
    if (mode === "new-password" || mode === "credential") {
      if (monitorKeys.cancel.matches(input, key)) {
        setMode(mode === "new-password" ? "picking" : "normal");
        if (mode === "credential") {
          setCredentialPane(-1);
          setCredentialError(undefined);
        }
        return;
      }
      return;
    }

    // ── Compose restart picker ──
    if (mode === "compose-restart") {
      if (monitorKeys.cancel.matches(input, key)) { setMode("normal"); return; }
      const run = (cmd: string) => paneRefsMap.current.get(paneKey(hosts[focusedPane]))!.run(cmd);
      if (input === "1" || monitorKeys.confirm.matches(input, key)) {
        setMode("normal");
        if (selectedService) runAction("restart", () => restartDockerService(run, selectedService));
        return;
      }
      if (input === "2") {
        setMode("normal");
        if (selectedService) runAction("restart stack", () => restartDockerStack(run, selectedService));
        return;
      }
      return;
    }

    // ── Normal mode ──
    if (monitorKeys.nextPane.matches(input, key)) { setFocusedPane((p) => (p + 1) % hosts.length); return; }
    if (monitorKeys.previousPane.matches(input, key)) { setFocusedPane((p) => (p - 1 + hosts.length) % hosts.length); return; }
    if (/^[1-9]$/.test(input) && Number(input) <= hosts.length) { setFocusedPane(Number(input) - 1); return; }

    if (monitorKeys.quit.matches(input, key)) { exit(); return; }
    if (monitorKeys.hosts.matches(input, key)) { onSwitchHost(); return; }

    if (monitorKeys.addPane.matches(input, key) && availableHosts.length > 0) {
      setPickerIdx(0);
      setMode("picking");
      return;
    }
    if (monitorKeys.closePane.matches(input, key) && hosts.length > 1) { removePane(focusedPane); return; }
    if (monitorKeys.swapLeft.matches(input, key) && hosts.length > 1) { swapPane(focusedPane, focusedPane - 1); return; }
    if (monitorKeys.swapRight.matches(input, key) && hosts.length > 1) { swapPane(focusedPane, focusedPane + 1); return; }

    if (focused.connection.status !== "online") {
      const pane = paneRefsMap.current.get(paneKey(hosts[focusedPane]));
      if (monitorKeys.retry.matches(input, key) && canRetryConnection(focused.connection)) pane?.retry();
      else if (monitorKeys.credentials.matches(input, key) && focused.connection.status === "needs-credential") pane?.requestCredential();
      return;
    }

    if (monitorKeys.logs.matches(input, key)) { setLogsOpen((o) => !o); return; }

    if (!selectedService || busy) return;

    const run = (cmd: string) => paneRefsMap.current.get(paneKey(hosts[focusedPane]))!.run(cmd);
    const isNative = selectedService.kind === "system-service";

    if (isNative) {
      if (monitorKeys.kill.matches(input, key)) runAction("kill", () => stopNativeService(run, selectedService, os));
      else if (monitorKeys.restart.matches(input, key)) runAction("restart", () => restartNativeService(run, selectedService, os));
      else if (monitorKeys.start.matches(input, key)) flash("Cannot start a discovered process", true);
    } else {
      if (monitorKeys.restart.matches(input, key)) {
        // For compose services, ask: restart container or whole stack?
        if (selectedService.composeProject) {
          setMode("compose-restart");
        } else {
          runAction("restart", () => restartDockerService(run, selectedService));
        }
      }
      else if (monitorKeys.stop.matches(input, key)) runAction("stop", () => stopDockerService(run, selectedService));
      else if (monitorKeys.start.matches(input, key)) runAction("start", () => startDockerService(run, selectedService));
    }
  });

  // ── Credential handler from a pane ────────────────────────────────────────
  const handleCredentialNeeded = useCallback((paneIdx: number, kind: "password" | "passphrase", error?: string) => {
    setCredentialPane(paneIdx);
    setCredentialKind(kind);
    setCredentialError(error);
    setCredentialValue("");
    setMode("credential");
  }, []);

  const handleCredentialSubmit = useCallback((value: string) => {
    if (credentialPane < 0 || !value.trim()) return;
    setConnectOpts((prev) => prev.map((options, i) =>
      i === credentialPane ? { ...options, [credentialKind]: value } : options
    ));
    setMode("normal");
    setCredentialPane(-1);
    setCredentialError(undefined);
  }, [credentialPane, credentialKind]);

  const logsVisible = logsOpen && mode === "normal";
  const layout = getTerminalLayout(terminalSize.columns, terminalSize.rows, hosts.length, logsVisible);
  const paneWidth = layout.paneWidth;
  const multi = hosts.length > 1;
  const onlineCount = paneStates.filter((pane) => pane.connection.status === "online").length;
  const failedCount = paneStates.filter((pane) => pane.connection.status === "offline" || pane.connection.status === "needs-credential").length;
  const pendingCount = hosts.length - onlineCount - failedCount;
  const visibleTabIndexes = getVisibleTabIndexes(columns, hosts.length, focusedPane);

  return (
    <Box flexDirection="column" width="100%" height="100%">

      {/* App bar — version + pane status overview */}
      <Box borderStyle="single" borderColor={palette.structure} paddingX={1} width="100%">
        <Box gap={1} flexGrow={1}>
          <Text bold color={palette.brand}>homelab-tui</Text>
          {!layout.narrow && <Text dimColor>v{VERSION}</Text>}
          {updateTag && !layout.narrow && <Text color={palette.warning} bold>↑ {updateTag} available</Text>}
          {multi && !layout.narrow && <Text dimColor>{onlineCount}/{hosts.length} online</Text>}
          {failedCount > 0 && !layout.narrow && <Text color={palette.danger}>{failedCount} failed</Text>}
          {pendingCount > 0 && !layout.narrow && <Text color={palette.warning}>{pendingCount} connecting</Text>}
        </Box>
        <Box gap={1} overflow="hidden">
          {multi && <><Text bold color={palette.structure}>[{monitorKeys.nextPane.display}]</Text>{!layout.narrow && <Text dimColor> cycle</Text>}</>}
          {visibleTabIndexes[0] > 0 && <Text dimColor>…</Text>}
          {visibleTabIndexes.map((i) => {
            const h = hosts[i];
            const paneConnection = paneStates[i]?.connection ?? { status: "connecting" };
            const isFocused = i === focusedPane;
            const failed = paneConnection.status === "offline" || paneConnection.status === "needs-credential";
            const status = failed ? palette.danger : paneConnection.status === "online" ? palette.healthy : palette.warning;
            return (
              <Box key={i} gap={1} maxWidth={layout.narrow ? 12 : 18}>
                <Text bold={isFocused} inverse={isFocused} color={isFocused ? palette.focus : palette.inactive} wrap="truncate">[{i + 1}] {h.name}</Text>
                <Text color={status}>{failed ? "✗" : paneConnection.status === "online" ? "●" : "○"}</Text>
              </Box>
            );
          })}
          {visibleTabIndexes.at(-1)! < hosts.length - 1 && <Text dimColor>…</Text>}
        </Box>
      </Box>

      {/* Keep every connection alive, but only the active tab takes layout space. */}
      <Box width="100%">
        {hosts.map((host, i) => (
          <Box key={paneKey(host)} visible={focusedPane === i} width="100%">
            <MonitorPane
              ref={(el) => { paneRefsMap.current.set(paneKey(host), el); }}
              hostConfig={host}
              connectOptions={connectOpts[i]}
              isActive={focusedPane === i && mode === "normal" && !logsOpen}
              paneCount={hosts.length}
              containerWidth={paneWidth}
              viewHeight={layout.serviceRows}
              compact={layout.compact || logsVisible}
              credentialPrompt={mode === "credential" && credentialPane === i ? {
                mode: credentialKind,
                value: credentialValue,
                error: credentialError,
                onChange: setCredentialValue,
                onSubmit: handleCredentialSubmit,
              } : undefined}
              onCredentialNeeded={(kind, error) => handleCredentialNeeded(i, kind, error)}
              onStateChange={(svc, snap, connection) =>
                setPaneStates((prev) => prev.map((s, j) => {
                  if (j !== i) return s;
                  return { service: svc, snapshot: snap, connection, history: mergeHistory(s.history, s.snapshot, snap) };
                }))
              }
            />
          </Box>
        ))}
      </Box>

      {/* Overlay: host picker */}
      {mode === "picking" && (
        <Box borderStyle="single" borderColor={palette.structure} paddingX={1} flexDirection="column">
          <Box gap={2}>
            <Text bold color={palette.structure}>Add host</Text>
            <Text dimColor>{monitorKeys.up.display}{monitorKeys.down.display} navigate · {monitorKeys.confirm.display} connect · {monitorKeys.cancel.display} cancel</Text>
          </Box>
          {availableHosts.length === 0 ? (
            <Text dimColor>All configured hosts are already open.</Text>
          ) : (
            availableHosts.map((h, i) => (
              <Box key={paneKey(h)} gap={1}>
                <Text color={i === pickerIdx ? palette.selected : palette.inactive}>{i === pickerIdx ? ">" : " "}</Text>
                <Text color={i === pickerIdx ? palette.selected : palette.inactive} inverse={i === pickerIdx}>
                  {h.name.padEnd(20)}
                </Text>
                <Text dimColor>{h.username}@{h.host}:{h.port}</Text>
              </Box>
            ))
          )}
        </Box>
      )}

      {/* New panes need a password before their pane exists. Re-prompts render inside the affected pane. */}
      {mode === "new-password" && pendingHost && (
        <Box borderStyle="single" borderColor={palette.warning} paddingX={1} flexDirection="column">
          <Box>
            <Text color={palette.warning}>Password for {pendingHost.name}: </Text>
            <TextInput
              value={credentialValue}
              onChange={setCredentialValue}
              onSubmit={(val) => {
                if (!val.trim()) return;
                addPane(pendingHost, { password: val });
              }}
              mask="*"
              focus
            />
            <Text dimColor>  {monitorKeys.cancel.display} cancel</Text>
          </Box>
        </Box>
      )}

      {/* Overlay: compose restart picker */}
      {mode === "compose-restart" && selectedService?.composeProject && (
        <Box borderStyle="single" borderColor={palette.structure} paddingX={1} flexDirection="column">
          <Box gap={2}>
            <Text bold color={palette.structure}>Restart scope — {selectedService.name}</Text>
            <Text dimColor>stack: {selectedService.composeProject}</Text>
          </Box>
          <Box gap={2} marginTop={1}>
            <Box gap={1}>
              <Text color={palette.structure} bold>1</Text>
              <Text>/ Enter</Text>
              <Text dimColor>restart this container only</Text>
            </Box>
            <Box gap={1}>
              <Text color={palette.structure} bold>2</Text>
              <Text dimColor>restart entire stack ({selectedService.composeProject})</Text>
            </Box>
            <Box gap={1}>
              <Text color={palette.structure} bold>{monitorKeys.cancel.display}</Text>
              <Text dimColor>cancel</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Shared details (only in normal mode) */}
      {mode === "normal" && focused.connection.status === "online" && (
        <ServiceDetails
          service={selectedService}
          history={focused.history}
          paneLabel={multi ? `[${focusedPane + 1}] ${hosts[focusedPane].name}` : undefined}
          containerWidth={terminalSize.columns}
          compact={layout.compact || logsVisible}
        />
      )}

      <LogPanel
        lines={logLines} loading={logsLoading}
        serviceName={selectedService?.name ?? null}
        visible={logsVisible}
        viewHeight={layout.logRows}
      />
      <Footer
        actionMessage={actionMessage}
        error={actionError}
        selectedKind={selectedService?.kind}
        paneCount={hosts.length}
        focusedPane={focusedPane}
        canAddPane={availableHosts.length > 0}
        canRemovePane={multi}
        connectionStatus={focused.connection.status}
        canRetry={canRetryConnection(focused.connection)}
        overlayActive={mode !== "normal"}
      />
    </Box>
  );
}
