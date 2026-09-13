import React, { useCallback, useEffect, useRef, useState } from "react";
import { useKeyboard, usePaste, useTerminalDimensions } from "@opentui/react";
import { Terminal } from "@xterm/headless";
import { Box, Text, TextInput, useApp, useInput } from "./tui.js";
import { MonitorPane, canRetryConnection } from "./MonitorPane.js";
import type { MonitorPaneHandle, PaneConnectionState } from "./MonitorPane.js";
import { HostForm } from "./HostForm.js";
import { ServiceDetails } from "./ServiceDetails.js";
import { LogPanel, splitLogChunk } from "./LogPanel.js";
import { Footer } from "./Footer.js";
import { TerminalPanel, moveItem, type TerminalSessionView } from "./TerminalPanel.js";
import {
  restartDockerService,
  restartDockerStack,
  startDockerService,
  stopDockerService,
} from "../adapters/docker.js";
import { stopNativeService, restartNativeService } from "../adapters/native-actions.js";
import { getLatestRelease, isNewerVersion } from "../updater.js";
import { version as VERSION } from "../../package.json";
import type { ConnectOptions, RemoteShell } from "../transports/ssh.js";
import type { HostConfig, MonitorSnapshot, Service, ServiceStatus, StatusChange } from "../core/types.js";
import { getShellSize, getTerminalLayout, getVisibleTabIndexes } from "./geometry.js";
import { encodeTerminalKey, monitorKeys } from "./keys.js";
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
type Mode = "normal" | "terminal" | "picking" | "creating" | "new-password" | "credential" | "compose-restart";

type TerminalSession = TerminalSessionView & {
  shell: RemoteShell | null;
  pendingInput: string[];
};

type HostTerminals = {
  sessions: TerminalSession[];
  activeIndex: number;
};

const hostKey = (host: HostConfig) => `${host.host}:${host.port}`;

export function getPickedHosts(
  availableHosts: HostConfig[],
  pickedHostKeys: ReadonlySet<string>,
  focusedIndex: number,
) {
  const picked = availableHosts.filter((host) => pickedHostKeys.has(hostKey(host)));
  if (picked.length > 0) return picked;
  const focused = availableHosts[focusedIndex];
  return focused ? [focused] : [];
}

type Props = {
  initialHosts: HostConfig[];
  initialConnectOptions: (ConnectOptions | undefined)[];
  allHosts: HostConfig[];       // all configured hosts (for the add-host picker)
  onCreateHost: (host: HostConfig) => void;
  onSwitchHost: () => void;
  onCloseLastTab: () => void;
};

export function MultiMonitor({ initialHosts, initialConnectOptions, allHosts, onCreateHost, onSwitchHost, onCloseLastTab }: Readonly<Props>) {
  const { exit } = useApp();
  const { width: columns, height: rows } = useTerminalDimensions();
  const terminalSize = { columns, rows };
  const shellSize = getShellSize(columns, rows);

  // Dynamic pane list — grows/shrinks as user adds/removes panes
  const [hosts, setHosts] = useState<HostConfig[]>(initialHosts);
  const [connectOpts, setConnectOpts] = useState<(ConnectOptions | undefined)[]>(initialConnectOptions);
  const [paneStates, setPaneStates] = useState<PaneState[]>(
    () => initialHosts.map(() => ({ service: null, snapshot: null, connection: { status: "connecting" }, history: new Map() }))
  );
  const [focusedPane, setFocusedPane] = useState(0);

  // Pane refs keyed by "host:port" so indices stay stable across add/remove
  const paneRefsMap = useRef<Map<string, MonitorPaneHandle | null>>(new Map());

  // Interactive shells are keyed by host so switching tabs never unmounts them.
  const terminalsRef = useRef<Map<string, HostTerminals>>(new Map());
  const nextTerminalIdRef = useRef(1);
  const terminalRenderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setTerminalRevision] = useState(0);
  const [terminalPrompt, setTerminalPrompt] = useState<"prefix" | "confirm-close" | null>(null);

  // Overlay mode
  const [mode, setMode] = useState<Mode>("normal");
  const [pickerIdx, setPickerIdx] = useState(0);
  const [pickedHostKeys, setPickedHostKeys] = useState<Set<string>>(new Set());
  const [credentialValue, setCredentialValue] = useState("");
  const [pendingHosts, setPendingHosts] = useState<HostConfig[]>([]);
  const [pendingConnectOpts, setPendingConnectOpts] = useState<(ConnectOptions | undefined)[]>([]);
  const [pendingPasswordIdx, setPendingPasswordIdx] = useState(-1);
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
  const activePickerIdx = Math.min(pickerIdx, availableHosts.length);
  const pendingHost = pendingHosts[pendingPasswordIdx] ?? null;

  const flash = (msg: string, isError = false) => {
    if (isError) setActionError(msg);
    else setActionMessage(msg);
    setTimeout(() => { setActionMessage(null); setActionError(null); }, 3_000);
  };

  const scheduleTerminalRender = useCallback(() => {
    if (terminalRenderTimerRef.current) return;
    terminalRenderTimerRef.current = setTimeout(() => {
      terminalRenderTimerRef.current = null;
      setTerminalRevision((revision) => revision + 1);
    }, 16);
  }, []);

  const disposeHostTerminals = useCallback((key: string) => {
    const group = terminalsRef.current.get(key);
    if (!group) return;
    for (const session of group.sessions) {
      session.shell?.close();
      session.terminal.dispose();
    }
    terminalsRef.current.delete(key);
  }, []);

  useEffect(() => () => {
    if (terminalRenderTimerRef.current) clearTimeout(terminalRenderTimerRef.current);
    for (const key of terminalsRef.current.keys()) disposeHostTerminals(key);
  }, [disposeHostTerminals]);

  useEffect(() => {
    for (const group of terminalsRef.current.values()) {
      for (const session of group.sessions) {
        session.terminal.resize(shellSize.columns, shellSize.rows);
        session.shell?.resize(shellSize);
      }
    }
    scheduleTerminalRender();
  }, [shellSize.columns, shellSize.rows, scheduleTerminalRender]);

  const openTerminal = useCallback((paneIndex = focusedPane) => {
    const host = hosts[paneIndex];
    const pane = host && paneRefsMap.current.get(hostKey(host));
    if (!host || !pane) return;

    const key = hostKey(host);
    const group = terminalsRef.current.get(key) ?? { sessions: [], activeIndex: 0 };
    terminalsRef.current.set(key, group);
    const id = nextTerminalIdRef.current++;
    const terminal = new Terminal({
      allowProposedApi: true,
      cols: shellSize.columns,
      rows: shellSize.rows,
      scrollback: 1_000,
    });
    const session: TerminalSession = {
      id,
      title: `shell ${id}`,
      status: "opening",
      terminal,
      shell: null,
      pendingInput: [],
    };
    const isOpen = () => terminalsRef.current.get(key)?.sessions.includes(session) === true;

    terminal.onData((data) => {
      if (session.shell) session.shell.input(data);
      else session.pendingInput.push(data);
    });
    terminal.onTitleChange((title) => {
      if (!isOpen()) return;
      const safeTitle = title.replace(/[\u0000-\u001f\u007f]/g, "").trim();
      if (safeTitle) session.title = safeTitle.slice(0, 80);
      scheduleTerminalRender();
    });

    group.sessions.push(session);
    group.activeIndex = group.sessions.length - 1;
    setLogsOpen(false);
    setTerminalPrompt(null);
    setMode("terminal");
    scheduleTerminalRender();

    pane.openShell(
      shellSize,
      (chunk) => {
        if (isOpen()) terminal.write(chunk, scheduleTerminalRender);
      },
      (error) => {
        if (!isOpen()) return;
        session.shell = null;
        session.status = error ? "error" : "exited";
        terminal.writeln(`\r\n[terminal ${error ? `failed: ${error.message}` : "closed"}]`, scheduleTerminalRender);
      },
    ).then((shell) => {
      if (!isOpen()) { shell.close(); return; }
      session.shell = shell;
      session.status = "live";
      for (const data of session.pendingInput.splice(0)) shell.input(data);
      scheduleTerminalRender();
    }).catch((error: unknown) => {
      if (!isOpen()) return;
      session.status = "error";
      terminal.writeln(`\r\n[terminal failed: ${error instanceof Error ? error.message : String(error)}]`, scheduleTerminalRender);
    });
  }, [focusedPane, hosts, shellSize.columns, shellSize.rows, scheduleTerminalRender]);

  const showTerminal = useCallback(() => {
    const host = hosts[focusedPane];
    const group = host && terminalsRef.current.get(hostKey(host));
    if (!group?.sessions.length) { openTerminal(); return; }
    setLogsOpen(false);
    setTerminalPrompt(null);
    setMode("terminal");
  }, [focusedPane, hosts, openTerminal]);

  const closeActiveTerminal = useCallback(() => {
    const host = hosts[focusedPane];
    const group = host && terminalsRef.current.get(hostKey(host));
    const session = group?.sessions[group.activeIndex];
    if (!group || !session) return;
    session.shell?.close();
    session.terminal.dispose();
    group.sessions.splice(group.activeIndex, 1);
    group.activeIndex = Math.min(group.activeIndex, Math.max(0, group.sessions.length - 1));
    setTerminalPrompt(null);
    if (group.sessions.length === 0) setMode("normal");
    scheduleTerminalRender();
  }, [focusedPane, hosts, scheduleTerminalRender]);

  // ── Add / remove panes ────────────────────────────────────────────────────
  const resetAddFlow = () => {
    setMode("normal");
    setPickedHostKeys(new Set());
    setCredentialValue("");
    setPendingHosts([]);
    setPendingConnectOpts([]);
    setPendingPasswordIdx(-1);
  };

  const addPanes = (nextHosts: HostConfig[], nextOptions: (ConnectOptions | undefined)[]) => {
    setHosts((prev) => [...prev, ...nextHosts]);
    setConnectOpts((prev) => [...prev, ...nextOptions]);
    setPaneStates((prev) => [
      ...prev,
      ...nextHosts.map(() => ({
        service: null,
        snapshot: null,
        connection: { status: "connecting" } as PaneConnectionState,
        history: new Map<string, StatusChange[]>(),
      })),
    ]);
    setFocusedPane(hosts.length + nextHosts.length - 1);
    resetAddFlow();
  };

  const beginAddingPickedHosts = () => {
    const nextHosts = getPickedHosts(availableHosts, pickedHostKeys, activePickerIdx);
    if (nextHosts.length === 0) return;
    const nextOptions = new Array<ConnectOptions | undefined>(nextHosts.length).fill(undefined);
    const firstPasswordIdx = nextHosts.findIndex((host) => host.authMethod === "password");
    if (firstPasswordIdx === -1) {
      addPanes(nextHosts, nextOptions);
      return;
    }
    setPendingHosts(nextHosts);
    setPendingConnectOpts(nextOptions);
    setPendingPasswordIdx(firstPasswordIdx);
    setCredentialValue("");
    setMode("new-password");
  };

  const handleNewPasswordSubmit = (value: string) => {
    if (!pendingHost || !value.trim()) return;
    const updated = [...pendingConnectOpts];
    updated[pendingPasswordIdx] = { password: value };
    const nextPasswordIdx = pendingHosts.findIndex(
      (host, index) => index > pendingPasswordIdx && host.authMethod === "password",
    );
    if (nextPasswordIdx === -1) {
      addPanes(pendingHosts, updated);
      return;
    }
    setPendingConnectOpts(updated);
    setPendingPasswordIdx(nextPasswordIdx);
    setCredentialValue("");
  };

  const handleCreatedHost = (host: HostConfig) => {
    onCreateHost(host);
    setPickedHostKeys((prev) => new Set(prev).add(hostKey(host)));
    setPickerIdx(availableHosts.length);
    setMode("picking");
  };

  const openCreateHostForm = () => setTimeout(() => setMode("creating"), 0);

  const removePane = useCallback((idx: number) => {
    disposeHostTerminals(hostKey(hosts[idx]));
    if (hosts.length <= 1) {
      onCloseLastTab();
      return;
    }
    paneRefsMap.current.delete(hostKey(hosts[idx]));
    setHosts((prev) => prev.filter((_, i) => i !== idx));
    setConnectOpts((prev) => prev.filter((_, i) => i !== idx));
    setPaneStates((prev) => prev.filter((_, i) => i !== idx));
    setFocusedPane((prev) => Math.min(prev, hosts.length - 2));
  }, [disposeHostTerminals, hosts, onCloseLastTab]);

  // ── Log streaming ─────────────────────────────────────────────────────────
  useEffect(() => {
    logCancelRef.current?.();
    logCancelRef.current = null;
    if (!logsOpen || !selectedService) { setLogLines([]); return; }

    setLogLines([]);
    setLogsLoading(true);
    let buf: string[] = [];
    let remainder = "";
    const pane = paneRefsMap.current.get(hostKey(hosts[focusedPane]));
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
  useKeyboard((key) => {
    if (mode !== "terminal") return;
    key.preventDefault();
    key.stopPropagation();

    const host = hosts[focusedPane];
    const group = host && terminalsRef.current.get(hostKey(host));
    const active = group?.sessions[group.activeIndex];
    const input = key.sequence || key.name;

    if (terminalPrompt === "confirm-close") {
      if (input === "y") closeActiveTerminal();
      else if (input === "n" || key.name === "escape") setTerminalPrompt(null);
      return;
    }

    if (terminalPrompt === "prefix") {
      setTerminalPrompt(null);
      if ((key.ctrl && key.name === "b") || input === "\u0002") { active?.terminal.input("\u0002"); return; }
      if (input === "d") { setMode("normal"); return; }
      if (input === "c") { openTerminal(); return; }
      if (input === "x" && active) {
        if (active.status === "live" || active.status === "opening") setTerminalPrompt("confirm-close");
        else closeActiveTerminal();
        return;
      }
      if ((input === "n" || input === "p") && group?.sessions.length) {
        const direction = input === "n" ? 1 : -1;
        group.activeIndex = (group.activeIndex + direction + group.sessions.length) % group.sessions.length;
        scheduleTerminalRender();
        return;
      }
      if ((input === "<" || input === ">") && group?.sessions.length) {
        const nextIndex = Math.min(
          Math.max(0, group.activeIndex + (input === ">" ? 1 : -1)),
          group.sessions.length - 1,
        );
        group.sessions = moveItem(group.sessions, group.activeIndex, nextIndex);
        group.activeIndex = nextIndex;
        scheduleTerminalRender();
        return;
      }
      if (/^[1-9]$/.test(input) && group && Number(input) <= group.sessions.length) {
        group.activeIndex = Number(input) - 1;
        scheduleTerminalRender();
        return;
      }
      if (key.name === "tab") {
        setFocusedPane((current) => (current + (key.shift ? -1 : 1) + hosts.length) % hosts.length);
        return;
      }
      return;
    }

    if ((key.ctrl && key.name === "b") || input === "\u0002") {
      setTerminalPrompt("prefix");
      return;
    }
    active?.terminal.input(encodeTerminalKey(key, active.terminal.modes.applicationCursorKeysMode));
  });

  usePaste((event) => {
    if (mode !== "terminal") return;
    event.preventDefault();
    event.stopPropagation();
    const host = hosts[focusedPane];
    const group = host && terminalsRef.current.get(hostKey(host));
    const active = group?.sessions[group.activeIndex];
    if (!active) return;
    const data = new TextDecoder().decode(event.bytes);
    active.terminal.input(active.terminal.modes.bracketedPasteMode ? `\u001b[200~${data}\u001b[201~` : data);
  });

  useInput((input, key) => {
    // ── Picker mode ──
    if (mode === "picking") {
      if (monitorKeys.up.matches(input, key))   { setPickerIdx((i) => Math.max(0, i - 1)); return; }
      if (monitorKeys.down.matches(input, key)) { setPickerIdx((i) => Math.min(availableHosts.length, i + 1)); return; }
      if (monitorKeys.cancel.matches(input, key)) { resetAddFlow(); return; }
      if (input === "n") { openCreateHostForm(); return; }
      if (input === " " && activePickerIdx < availableHosts.length) {
        const selectedKey = hostKey(availableHosts[activePickerIdx]);
        setPickedHostKeys((prev) => {
          const next = new Set(prev);
          next.has(selectedKey) ? next.delete(selectedKey) : next.add(selectedKey);
          return next;
        });
        return;
      }
      if (monitorKeys.confirm.matches(input, key)) {
        if (activePickerIdx === availableHosts.length) openCreateHostForm();
        else beginAddingPickedHosts();
      }
      return;
    }

    if (mode === "creating") return;

    // ── Credential modes ──
    if (mode === "new-password" || mode === "credential") {
      if (monitorKeys.cancel.matches(input, key)) {
        if (mode === "new-password") {
          resetAddFlow();
        } else {
          setMode("normal");
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
      const run = (cmd: string) => paneRefsMap.current.get(hostKey(hosts[focusedPane]))!.run(cmd);
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

    if (monitorKeys.addPane.matches(input, key)) {
      setPickedHostKeys(new Set());
      setPickerIdx(0);
      setMode("picking");
      return;
    }
    if (monitorKeys.closePane.matches(input, key)
      && (hosts.length > 1 || focused.connection.status === "disconnected")) {
      removePane(focusedPane);
      return;
    }

    if (focused.connection.status !== "online") {
      const pane = paneRefsMap.current.get(hostKey(hosts[focusedPane]));
      if (monitorKeys.retry.matches(input, key) && canRetryConnection(focused.connection)) pane?.retry();
      else if (monitorKeys.credentials.matches(input, key) && focused.connection.status === "needs-credential") pane?.requestCredential();
      return;
    }

    if (monitorKeys.terminal.matches(input, key)) { showTerminal(); return; }
    if (monitorKeys.logs.matches(input, key)) { setLogsOpen((o) => !o); return; }

    if (!selectedService || busy) return;

    const run = (cmd: string) => paneRefsMap.current.get(hostKey(hosts[focusedPane]))!.run(cmd);
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
  }, { isActive: mode !== "terminal" });

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

  const logsVisible = logsOpen && mode === "normal" && focused.connection.status === "online";
  const layout = getTerminalLayout(terminalSize.columns, terminalSize.rows, hosts.length, logsVisible);
  const paneWidth = layout.paneWidth;
  const multi = hosts.length > 1;
  const onlineCount = paneStates.filter((pane) => pane.connection.status === "online").length;
  const failedCount = paneStates.filter((pane) => ["disconnected", "offline", "needs-credential"].includes(pane.connection.status)).length;
  const pendingCount = hosts.length - onlineCount - failedCount;
  const visibleTabIndexes = getVisibleTabIndexes(columns, hosts.length, focusedPane);
  const activeTerminalGroup = terminalsRef.current.get(hostKey(hosts[focusedPane]));
  const addFlowActive = mode === "picking" || mode === "creating" || mode === "new-password";
  const pickerItemCount = availableHosts.length + 1;
  const pickerVisibleCount = Math.min(pickerItemCount, Math.max(1, rows - 13));
  const pickerStart = Math.min(
    Math.max(0, activePickerIdx - Math.floor(pickerVisibleCount / 2)),
    pickerItemCount - pickerVisibleCount,
  );
  const visiblePickerIndexes = Array.from(
    { length: pickerVisibleCount },
    (_, index) => pickerStart + index,
  );
  const passwordTotal = pendingHosts.filter((host) => host.authMethod === "password").length;
  const passwordNumber = pendingHosts
    .slice(0, pendingPasswordIdx + 1)
    .filter((host) => host.authMethod === "password").length;

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
            const failed = ["disconnected", "offline", "needs-credential"].includes(paneConnection.status);
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
          <Box key={hostKey(host)} visible={focusedPane === i && !addFlowActive && mode !== "terminal"} width="100%">
            <MonitorPane
              ref={(el) => { paneRefsMap.current.set(hostKey(host), el); }}
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

      {mode === "terminal" && (
        <TerminalPanel
          sessions={activeTerminalGroup?.sessions ?? []}
          activeIndex={activeTerminalGroup?.activeIndex ?? 0}
          width={terminalSize.columns}
        />
      )}

      {mode === "creating" && (
        <HostForm onSubmit={handleCreatedHost} onCancel={resetAddFlow} />
      )}

      {/* Overlay: host picker */}
      {mode === "picking" && (
        <Box borderStyle="single" borderColor={palette.structure} paddingX={1} flexDirection="column" flexGrow={1}>
          <Box flexDirection="column">
            <Text bold color={palette.structure}>Add hosts ({pickedHostKeys.size} selected)</Text>
            <Text dimColor wrap="wrap">{monitorKeys.up.display}{monitorKeys.down.display} navigate · Space select · {monitorKeys.confirm.display} add · n new · {monitorKeys.cancel.display} cancel</Text>
          </Box>
          {pickerStart > 0 && <Text dimColor>  … {pickerStart} more above</Text>}
          {visiblePickerIndexes.map((i) => {
            const focused = i === activePickerIdx;
            if (i === availableHosts.length) {
              return (
                <Box key="create-host" gap={1}>
                  <Text color={focused ? palette.selected : palette.inactive}>{focused ? ">" : " "}</Text>
                  <Text bold={focused} inverse={focused} color={focused ? palette.selected : palette.inactive}>
                    [+] Create new host
                  </Text>
                </Box>
              );
            }
            const host = availableHosts[i];
            const checked = pickedHostKeys.has(hostKey(host));
            return (
              <Box key={hostKey(host)} gap={1} width="100%">
                <Text color={focused ? palette.selected : palette.inactive}>{focused ? ">" : " "}</Text>
                <Text color={checked ? palette.focus : palette.inactive}>{checked ? "[✓]" : "[ ]"}</Text>
                <Box width={layout.narrow ? 18 : 24} overflow="hidden">
                  <Text bold={focused} inverse={focused} color={focused ? palette.selected : palette.inactive} wrap="truncate">
                    {host.name}
                  </Text>
                </Box>
                <Box flexGrow={1} overflow="hidden">
                  <Text dimColor wrap="truncate">{host.username}@{host.host}:{host.port}</Text>
                </Box>
              </Box>
            );
          })}
          {pickerStart + pickerVisibleCount < pickerItemCount && (
            <Text dimColor>  … {pickerItemCount - pickerStart - pickerVisibleCount} more below</Text>
          )}
        </Box>
      )}

      {/* New panes need a password before their pane exists. Re-prompts render inside the affected pane. */}
      {mode === "new-password" && pendingHost && (
        <Box borderStyle="single" borderColor={palette.warning} paddingX={1} flexDirection="column" flexGrow={1}>
          <Box>
            <Text color={palette.warning}>Password for {pendingHost.name} ({passwordNumber}/{passwordTotal}): </Text>
            <TextInput
              key={pendingPasswordIdx}
              value={credentialValue}
              onChange={setCredentialValue}
              onSubmit={handleNewPasswordSubmit}
              mask="*"
              focus
            />
            <Text dimColor>  {monitorKeys.cancel.display} cancel add</Text>
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
      {mode !== "creating" && (
        <Footer
          actionMessage={actionMessage}
          error={actionError}
          selectedKind={selectedService?.kind}
          paneCount={hosts.length}
          focusedPane={focusedPane}
          canAddPane
          canRemovePane={multi || focused.connection.status === "disconnected"}
          connectionStatus={focused.connection.status}
          canRetry={canRetryConnection(focused.connection)}
          overlayActive={mode !== "normal"}
          terminal={mode === "terminal" ? {
            active: activeTerminalGroup?.activeIndex ?? 0,
            count: activeTerminalGroup?.sessions.length ?? 0,
            hostIndex: focusedPane,
            hostCount: hosts.length,
            prompt: terminalPrompt,
            title: activeTerminalGroup?.sessions[activeTerminalGroup.activeIndex]?.title.slice(0, 30),
          } : undefined}
        />
      )}
    </Box>
  );
}
