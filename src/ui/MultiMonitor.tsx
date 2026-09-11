import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { Box, Text, TextInput, useApp, useInput } from "./tui.js";
import { MonitorPane } from "./MonitorPane.js";
import type { MonitorPaneHandle } from "./MonitorPane.js";
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
import { getTerminalLayout } from "./geometry.js";
import { monitorKeys } from "./keys.js";
import { palette } from "./palette.js";

const MAX_LOG_LINES = 2000;
const MAX_HISTORY = 5;

type PaneState = {
  service: Service | null;
  snapshot: MonitorSnapshot | null;
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
type Mode = "normal" | "picking" | "new-password" | "passphrase" | "auth-failed" | "compose-restart";

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
    () => initialHosts.map(() => ({ service: null, snapshot: null, history: new Map() }))
  );
  const [focusedPane, setFocusedPane] = useState(0);

  // Pane refs keyed by "host:port" so indices stay stable across add/remove
  const paneRefsMap = useRef<Map<string, MonitorPaneHandle | null>>(new Map());
  const paneKey = (h: HostConfig) => `${h.host}:${h.port}`;

  // Overlay mode
  const [mode, setMode] = useState<Mode>("normal");
  const [pickerIdx, setPickerIdx] = useState(0);
  const [credentialValue, setCredentialValue] = useState("");
  const [pendingHost, setPendingHost] = useState<HostConfig | null>(null);   // for new-password / passphrase
  const [passphrasePane, setPassphrasePane] = useState<number>(-1);          // which pane needs passphrase

  // Logs
  const [logsOpen, setLogsOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const logCancelRef = useRef<(() => void) | null>(null);

  // Actions
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auth failure re-prompt
  const [authFailedPane, setAuthFailedPane] = useState(-1);
  const [authFailedError, setAuthFailedError] = useState("");

  // Update check (once)
  const [updateTag, setUpdateTag] = useState<string | null>(null);
  useEffect(() => {
    getLatestRelease()
      .then(({ tag }) => { if (isNewerVersion(tag, VERSION)) setUpdateTag(tag); })
      .catch(() => {});
  }, []);

  const focused = paneStates[focusedPane] ?? { service: null, snapshot: null };
  const selectedService = focused.service;
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
    setPaneStates((prev) => [...prev, { service: null, snapshot: null, history: new Map() }]);
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

    // ── Credential / auth-failed modes ──
    if (mode === "new-password" || mode === "passphrase" || mode === "auth-failed") {
      if (monitorKeys.cancel.matches(input, key)) {
        setMode(mode === "new-password" ? "picking" : "normal");
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

    if (monitorKeys.quit.matches(input, key)) { exit(); return; }
    if (monitorKeys.hosts.matches(input, key)) { onSwitchHost(); return; }
    if (monitorKeys.logs.matches(input, key)) { setLogsOpen((o) => !o); return; }

    if (monitorKeys.addPane.matches(input, key) && availableHosts.length > 0) {
      setPickerIdx(0);
      setMode("picking");
      return;
    }
    if (monitorKeys.closePane.matches(input, key) && hosts.length > 1) { removePane(focusedPane); return; }
    if (monitorKeys.swapLeft.matches(input, key) && hosts.length > 1) { swapPane(focusedPane, focusedPane - 1); return; }
    if (monitorKeys.swapRight.matches(input, key) && hosts.length > 1) { swapPane(focusedPane, focusedPane + 1); return; }

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

  // ── Passphrase handler from a pane ────────────────────────────────────────
  const handleNeedPassphrase = useCallback((paneIdx: number) => {
    setPassphrasePane(paneIdx);
    setPendingHost(hosts[paneIdx]);
    setCredentialValue("");
    setMode("passphrase");
  }, [hosts]);

  const handlePassphraseSubmit = useCallback((val: string) => {
    if (passphrasePane < 0) return;
    setConnectOpts((prev) => prev.map((o, i) => i === passphrasePane ? { passphrase: val } : o));
    setMode("normal");
    setPassphrasePane(-1);
  }, [passphrasePane]);

  const handleAuthFailed = useCallback((paneIdx: number, msg: string) => {
    setAuthFailedPane(paneIdx);
    setPendingHost(hosts[paneIdx]);
    setCredentialValue("");
    setAuthFailedError(msg);
    setMode("auth-failed");
  }, [hosts]);

  const logsVisible = logsOpen && mode === "normal";
  const layout = getTerminalLayout(terminalSize.columns, terminalSize.rows, hosts.length, logsVisible);
  const paneWidth = layout.paneWidth;
  const multi = hosts.length > 1;
  const onlineCount = paneStates.filter((pane) => pane.snapshot && !pane.snapshot.error).length;
  const failedCount = paneStates.filter((pane) => pane.snapshot?.error).length;
  const pendingCount = hosts.length - onlineCount - failedCount;
  const hostOverview = (layout.narrow
    ? hosts.map((host, index) => ({ host, index })).filter(({ index }) => index === focusedPane)
    : hosts.map((host, index) => ({ host, index })));

  return (
    <Box flexDirection="column" width="100%" height="100%">

      {/* App bar — version + pane status overview */}
      <Box borderStyle="single" borderColor={palette.structure} paddingX={1} width="100%">
        <Box gap={1} flexGrow={1}>
          <Text bold color={palette.brand}>homelab-tui</Text>
          <Text dimColor>v{VERSION}</Text>
          {updateTag && !layout.narrow && <Text color={palette.warning} bold>↑ {updateTag} available</Text>}
          {multi && <Text dimColor>{onlineCount}/{hosts.length} online</Text>}
          {failedCount > 0 && <Text color={palette.danger}>{failedCount} failed</Text>}
          {pendingCount > 0 && <Text color={palette.warning}>{pendingCount} connecting</Text>}
        </Box>
        <Box gap={2}>
          {hostOverview.map(({ host: h, index: i }) => {
            const snap = paneStates[i]?.snapshot;
            const isFocused = i === focusedPane;
            const status = snap?.error ? palette.danger : snap ? palette.healthy : palette.warning;
            return (
              <Box key={i} gap={1}>
                <Text color={isFocused ? palette.focus : palette.inactive}>{isFocused ? "▶" : " "}</Text>
                <Text bold={isFocused} color={isFocused ? palette.focus : palette.inactive}>[{i + 1}] {h.name}</Text>
                <Text color={status}>{snap?.error ? "✗" : snap ? "●" : "○"}</Text>
              </Box>
            );
          })}
        </Box>
        {multi && !layout.narrow && <Text dimColor>  {monitorKeys.nextPane.display}: switch</Text>}
      </Box>

      {/* Panes */}
      <Box flexDirection="row" width="100%">
        {hosts.map((host, i) => (
          <MonitorPane
            key={paneKey(host)}
            ref={(el) => { paneRefsMap.current.set(paneKey(host), el); }}
            hostConfig={host}
            connectOptions={connectOpts[i]}
            isActive={focusedPane === i && mode === "normal" && !logsOpen}
            focused={focusedPane === i}
            paneIndex={i}
            paneCount={hosts.length}
            version={VERSION}
            updateTag={updateTag}
            containerWidth={paneWidth}
            viewHeight={layout.serviceRows}
            compact={layout.compact || logsVisible}
            onNeedPassphrase={() => handleNeedPassphrase(i)}
            onAuthFailed={(msg) => handleAuthFailed(i, msg)}
            onStateChange={(svc, snap) =>
              setPaneStates((prev) => prev.map((s, j) => {
                if (j !== i) return s;
                return { service: svc, snapshot: snap, history: mergeHistory(s.history, s.snapshot, snap) };
              }))
            }
          />
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

      {/* Overlay: credential (new pane password, passphrase, or auth re-prompt) */}
      {(mode === "new-password" || mode === "passphrase" || mode === "auth-failed") && pendingHost && (
        <Box borderStyle="single" borderColor={mode === "auth-failed" ? palette.danger : palette.warning}
          paddingX={1} flexDirection="column">
          {mode === "auth-failed" && (
            <Text color={palette.danger}>Authentication failed — check your password and try again.</Text>
          )}
          <Box>
            <Text color={mode === "auth-failed" ? palette.danger : palette.warning}>
              {mode === "passphrase" ? "Passphrase" : "Password"} for {pendingHost.name}:{" "}
            </Text>
            <TextInput
              value={credentialValue}
              onChange={setCredentialValue}
              onSubmit={(val) => {
                if (!val.trim()) return;
                if (mode === "new-password") {
                  addPane(pendingHost, { password: val });
                } else if (mode === "auth-failed") {
                  setConnectOpts((prev) =>
                    prev.map((o, i) => i === authFailedPane ? { password: val } : o)
                  );
                  setMode("normal");
                  setAuthFailedPane(-1);
                  setAuthFailedError("");
                } else {
                  handlePassphraseSubmit(val);
                }
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
      {mode === "normal" && (
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
      />
    </Box>
  );
}
