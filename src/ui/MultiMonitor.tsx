import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { MonitorPane } from "./MonitorPane.js";
import type { MonitorPaneHandle } from "./MonitorPane.js";
import { ServiceDetails } from "./ServiceDetails.js";
import { LogPanel } from "./LogPanel.js";
import { Footer } from "./Footer.js";
import {
  restartDockerService,
  startDockerService,
  stopDockerService,
} from "../adapters/docker.js";
import { stopNativeService, restartNativeService } from "../adapters/native-actions.js";
import { getLatestRelease, isNewerVersion } from "../updater.js";
import { version as VERSION } from "../../package.json";
import type { ConnectOptions } from "../transports/ssh.js";
import type { HostConfig, MonitorSnapshot, Service } from "../core/types.js";

const MAX_LOG_LINES = 2000;

type PaneState = { service: Service | null; snapshot: MonitorSnapshot | null };
type Mode = "normal" | "picking" | "new-password" | "passphrase" | "auth-failed";

type Props = {
  initialHosts: HostConfig[];
  initialConnectOptions: (ConnectOptions | undefined)[];
  allHosts: HostConfig[];       // all configured hosts (for the add-host picker)
  onSwitchHost: () => void;
};

export function MultiMonitor({ initialHosts, initialConnectOptions, allHosts, onSwitchHost }: Readonly<Props>) {
  const { exit } = useApp();

  // Dynamic pane list — grows/shrinks as user adds/removes panes
  const [hosts, setHosts] = useState<HostConfig[]>(initialHosts);
  const [connectOpts, setConnectOpts] = useState<(ConnectOptions | undefined)[]>(initialConnectOptions);
  const [paneStates, setPaneStates] = useState<PaneState[]>(
    () => initialHosts.map(() => ({ service: null, snapshot: null }))
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
    setPaneStates((prev) => [...prev, { service: null, snapshot: null }]);
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
    const pane = paneRefsMap.current.get(paneKey(hosts[focusedPane]));
    if (!pane) return;

    pane.streamLogs(
      selectedService,
      (chunk) => {
        const incoming = chunk.split("\n").filter((l) => l.length > 0);
        buf = [...buf, ...incoming].slice(-MAX_LOG_LINES);
        setLogLines([...buf]);
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
      if (key.upArrow)   { setPickerIdx((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setPickerIdx((i) => Math.min(availableHosts.length - 1, i + 1)); return; }
      if (key.escape)    { setMode("normal"); return; }
      if (key.return && availableHosts.length > 0) {
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
      if (key.escape) {
        setMode(mode === "new-password" ? "picking" : "normal");
        return;
      }
      return;
    }

    // ── Normal mode ──
    const shiftTab = input === "[Z" || (key.shift && key.tab);
    if (key.tab && !shiftTab) { setFocusedPane((p) => (p + 1) % hosts.length); return; }
    if (shiftTab)             { setFocusedPane((p) => (p - 1 + hosts.length) % hosts.length); return; }

    if (input === "q") { exit(); setTimeout(() => process.exit(0), 50); return; }
    if (input === "h") { onSwitchHost(); return; }
    if (input === "l") { setLogsOpen((o) => !o); return; }

    if (input === "a" && availableHosts.length > 0) {
      setPickerIdx(0);
      setMode("picking");
      return;
    }
    if (input === "x" && hosts.length > 1) { removePane(focusedPane); return; }
    if (input === "<" && hosts.length > 1) { swapPane(focusedPane, focusedPane - 1); return; }
    if (input === ">" && hosts.length > 1) { swapPane(focusedPane, focusedPane + 1); return; }

    if (!selectedService || busy) return;

    const run = (cmd: string) => paneRefsMap.current.get(paneKey(hosts[focusedPane]))!.run(cmd);
    const isNative = selectedService.kind === "system-service";

    if (isNative) {
      if (input === "s") runAction("kill",    () => stopNativeService(run, selectedService, os));
      else if (input === "r") runAction("restart", () => restartNativeService(run, selectedService, os));
      else if (input === "t") flash("Cannot start a discovered process", true);
    } else {
      if (input === "r") runAction("restart", () => restartDockerService(run, selectedService));
      else if (input === "s") runAction("stop",    () => stopDockerService(run, selectedService));
      else if (input === "t") runAction("start",   () => startDockerService(run, selectedService));
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

  const paneWidth = Math.floor(process.stdout.columns / hosts.length) - 2;
  const multi = hosts.length > 1;

  return (
    <Box flexDirection="column" width="100%">

      {/* App bar — version + pane status overview */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} width="100%">
        <Box gap={1} flexGrow={1}>
          <Text bold color="cyan">homelab-tui</Text>
          <Text dimColor>v{VERSION}</Text>
          {updateTag && <Text color="yellow" bold>↑ {updateTag} available</Text>}
        </Box>
        <Box gap={2}>
          {hosts.map((h, i) => {
            const snap = paneStates[i]?.snapshot;
            const ok = snap && !snap.error;
            const isFocused = i === focusedPane;
            return (
              <Box key={i} gap={1}>
                <Text color={isFocused ? "cyan" : "gray"}>{isFocused ? "▶" : " "}</Text>
                <Text bold={isFocused} color={isFocused ? "cyan" : "gray"}>[{i + 1}] {h.name}</Text>
                <Text color={ok ? "green" : "yellow"}>{ok ? "●" : "○"}</Text>
              </Box>
            );
          })}
        </Box>
        {multi && <Text dimColor>  Tab: switch</Text>}
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
            onNeedPassphrase={() => handleNeedPassphrase(i)}
            onAuthFailed={(msg) => handleAuthFailed(i, msg)}
            onStateChange={(svc, snap) =>
              setPaneStates((prev) => prev.map((s, j) => j === i ? { service: svc, snapshot: snap } : s))
            }
          />
        ))}
      </Box>

      {/* Overlay: host picker */}
      {mode === "picking" && (
        <Box borderStyle="single" borderColor="cyan" paddingX={1} flexDirection="column">
          <Box gap={2}>
            <Text bold color="cyan">Add host</Text>
            <Text dimColor>↑↓ navigate · Enter connect · Esc cancel</Text>
          </Box>
          {availableHosts.length === 0 ? (
            <Text dimColor>All configured hosts are already open.</Text>
          ) : (
            availableHosts.map((h, i) => (
              <Box key={paneKey(h)} gap={1}>
                <Text color={i === pickerIdx ? "white" : "gray"}>{i === pickerIdx ? ">" : " "}</Text>
                <Text color={i === pickerIdx ? "white" : "gray"} inverse={i === pickerIdx}>
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
        <Box borderStyle="single" borderColor={mode === "auth-failed" ? "red" : "yellow"}
          paddingX={1} flexDirection="column">
          {mode === "auth-failed" && (
            <Text color="red">Authentication failed — check your password and try again.</Text>
          )}
          <Box>
            <Text color={mode === "auth-failed" ? "red" : "yellow"}>
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
            <Text dimColor>  Esc cancel</Text>
          </Box>
        </Box>
      )}

      {/* Shared details (only in normal mode) */}
      {mode === "normal" && (
        <ServiceDetails
          service={selectedService}
          paneLabel={multi ? `[${focusedPane + 1}] ${hosts[focusedPane].name}` : undefined}
        />
      )}

      <LogPanel
        lines={logLines} loading={logsLoading}
        serviceName={selectedService?.name ?? null}
        visible={logsOpen}
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
