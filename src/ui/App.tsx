import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, useApp, useInput } from "ink";
import { Monitor, PassphraseRequiredError } from "../core/monitor.js";
import type { ConnectOptions } from "../transports/ssh.js";
import {
  restartDockerService,
  startDockerService,
  stopDockerService,
} from "../adapters/docker.js";
import type { HostConfig, MonitorSnapshot, Service } from "../core/types.js";
import { Header } from "./Header.js";
import { SystemPanel } from "./SystemPanel.js";
import { ServiceList } from "./ServiceList.js";
import { ServiceDetails } from "./ServiceDetails.js";
import { LogPanel } from "./LogPanel.js";
import { Footer } from "./Footer.js";

const REFRESH_MS = 3_000;

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
  const [logsOpen, setLogsOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const logCancelRef = useRef<(() => void) | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const MAX_LOG_LINES = 2000;

  const services: Service[] = snapshot?.services ?? [];
  const selectedService: Service | null = services[selectedIndex] ?? null;

  // Start/restart live log stream when panel is open or selection changes
  useEffect(() => {
    // Cancel any running stream first
    logCancelRef.current?.();
    logCancelRef.current = null;

    if (!logsOpen || !selectedService) {
      setLogLines([]);
      return;
    }

    setLogLines([]);
    setLogsLoading(true);
    let buf: string[] = [];

    const mon = monitorRef.current;
    if (!mon) return;

    mon.streamLogs(
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

    return () => {
      logCancelRef.current?.();
      logCancelRef.current = null;
    };
  // selectedIndex is intentionally stable dep — selectedService ref changes every refresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, logsOpen]);

  const flash = (msg: string, isError = false) => {
    if (isError) setActionError(msg);
    else setActionMessage(msg);
    setTimeout(() => {
      setActionMessage(null);
      setActionError(null);
    }, 3_000);
  };

  const doRefresh = useCallback(async () => {
    const mon = monitorRef.current;
    if (!mon) return;
    try {
      const snap = await mon.refresh();
      setSnapshot(snap);
      setLastUpdated(new Date());
      setConnecting(false);
    } catch {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    const mon = new Monitor(hostConfig);
    monitorRef.current = mon;
    setConnecting(true);
    setSnapshot(null);

    mon
      .connect(connectOptions)
      .then(() => doRefresh())
      .catch((err: unknown) => {
        if (err instanceof PassphraseRequiredError) {
          onNeedPassphrase();
          return;
        }
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
    };
  }, [hostConfig, connectOptions, doRefresh, onNeedPassphrase]);

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
      } finally {
        setBusy(false);
      }
    },
    [busy, selectedService, doRefresh]
  );

  const getRunner = () => (cmd: string) => monitorRef.current!.run(cmd);

  useInput((input, key) => {
    if (input === "q") { exit(); return; }
    if (input === "h") { onSwitchHost(); return; }

    if (!logsOpen) {
      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(services.length - 1, i + 1));
        return;
      }
    }

    if (!selectedService || busy) return;

    if (input === "r") {
      runAction("restart", () => restartDockerService(getRunner(), selectedService));
    } else if (input === "s") {
      runAction("stop", () => stopDockerService(getRunner(), selectedService));
    } else if (input === "t") {
      runAction("start", () => startDockerService(getRunner(), selectedService));
    } else if (input === "l") {
      setLogsOpen((open) => !open);
    }
  });

  const error = snapshot?.error ?? actionError ?? null;

  return (
    <Box flexDirection="column" width="100%">
      <Header snapshot={snapshot} connecting={connecting} lastUpdated={lastUpdated} />
      {snapshot?.system && <SystemPanel system={snapshot.system} />}
      <ServiceList services={services} selectedIndex={selectedIndex} />
      <ServiceDetails service={selectedService} />
      <LogPanel
        lines={logLines}
        loading={logsLoading}
        serviceName={selectedService?.name ?? null}
        visible={logsOpen}
      />
      <Footer actionMessage={actionMessage} error={error} />
    </Box>
  );
}
