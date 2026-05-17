import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, useApp, useInput } from "ink";
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
import { stopNativeService } from "../adapters/native-actions.js";
import { getLatestRelease } from "../updater.js";
import { version as VERSION } from "../../package.json";
import type { ConnectOptions } from "../transports/ssh.js";
import type { HostConfig, MonitorSnapshot, Service } from "../core/types.js";

const MAX_LOG_LINES = 2000;

type PaneState = { service: Service | null; snapshot: MonitorSnapshot | null };

type Props = {
  hosts: HostConfig[];
  connectOptions: (ConnectOptions | undefined)[];
  onSwitchHost: () => void;
};

export function MultiMonitor({ hosts, connectOptions, onSwitchHost }: Readonly<Props>) {
  const { exit } = useApp();
  const paneRefs = useRef<(MonitorPaneHandle | null)[]>([]);

  const [focusedPane, setFocusedPane] = useState(0);
  const [paneStates, setPaneStates] = useState<PaneState[]>(
    () => hosts.map(() => ({ service: null, snapshot: null }))
  );

  const [logsOpen, setLogsOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const logCancelRef = useRef<(() => void) | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [updateTag, setUpdateTag] = useState<string | null>(null);

  useEffect(() => {
    getLatestRelease()
      .then(({ tag }) => { if (tag !== `v${VERSION}`) setUpdateTag(tag); })
      .catch(() => {});
  }, []);

  const focused = paneStates[focusedPane] ?? { service: null, snapshot: null };
  const selectedService = focused.service;
  const os = focused.snapshot?.remoteOS ?? "unknown";

  const flash = (msg: string, isError = false) => {
    if (isError) setActionError(msg);
    else setActionMessage(msg);
    setTimeout(() => { setActionMessage(null); setActionError(null); }, 3_000);
  };

  // Log streaming — re-run when focused pane, service, or logsOpen changes
  useEffect(() => {
    logCancelRef.current?.();
    logCancelRef.current = null;
    if (!logsOpen || !selectedService) { setLogLines([]); return; }

    setLogLines([]);
    setLogsLoading(true);
    let buf: string[] = [];
    const pane = paneRefs.current[focusedPane];
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
        const msg = err instanceof Error ? err.message : String(err);
        setLogLines([`Error: ${msg}`]);
        setLogsLoading(false);
      });

    return () => { logCancelRef.current?.(); logCancelRef.current = null; };
  }, [focusedPane, selectedService?.id, logsOpen]);

  const runAction = useCallback(async (action: string, fn: () => Promise<void>) => {
    if (busy || !selectedService) return;
    setBusy(true);
    try {
      await fn();
      flash(`${action} ${selectedService.name} ok`);
      await paneRefs.current[focusedPane]?.run("true"); // trigger pane refresh via next poll
    } catch (err: unknown) {
      flash(`${action} failed: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally { setBusy(false); }
  }, [busy, selectedService, focusedPane]);

  useInput((input, key) => {
    // Tab / Shift+Tab — switch focused pane
    const shiftTab = input === "[Z" || (key.shift && key.tab);
    if (key.tab && !shiftTab) { setFocusedPane((p) => (p + 1) % hosts.length); return; }
    if (shiftTab)             { setFocusedPane((p) => (p - 1 + hosts.length) % hosts.length); return; }

    if (input === "q") { exit(); return; }
    if (input === "h") { onSwitchHost(); return; }
    if (input === "l") { setLogsOpen((o) => !o); return; }

    if (!selectedService || busy) return;

    const run = (cmd: string) => paneRefs.current[focusedPane]!.run(cmd);
    const isNative = selectedService.kind === "system-service";

    if (isNative) {
      if (input === "s") runAction("kill", () => stopNativeService(run, selectedService, os));
      else if (input === "r" || input === "t") flash("Not available for discovered processes", true);
    } else {
      if (input === "r") runAction("restart", () => restartDockerService(run, selectedService));
      else if (input === "s") runAction("stop",    () => stopDockerService(run, selectedService));
      else if (input === "t") runAction("start",   () => startDockerService(run, selectedService));
    }
  });

  const paneWidth = Math.floor(process.stdout.columns / hosts.length) - 2;
  const error = actionError ?? null;

  return (
    <Box flexDirection="column" width="100%">
      {/* Panes side by side */}
      <Box flexDirection="row" width="100%">
        {hosts.map((host, i) => (
          <MonitorPane
            key={`${host.host}:${host.port}`}
            ref={(el) => { paneRefs.current[i] = el; }}
            hostConfig={host}
            connectOptions={connectOptions[i]}
            isActive={focusedPane === i}
            focused={focusedPane === i}
            version={VERSION}
            updateTag={updateTag}
            containerWidth={paneWidth}
            onStateChange={(svc, snap) =>
              setPaneStates((prev) => prev.map((s, j) => j === i ? { service: svc, snapshot: snap } : s))
            }
          />
        ))}
      </Box>

      {/* Shared panels for the focused pane */}
      <ServiceDetails service={selectedService} />
      <LogPanel
        lines={logLines} loading={logsLoading}
        serviceName={selectedService?.name ?? null}
        visible={logsOpen}
      />
      <Footer
        actionMessage={actionMessage}
        error={error}
        selectedKind={selectedService?.kind}
        paneCount={hosts.length}
        focusedPane={focusedPane}
      />
    </Box>
  );
}
