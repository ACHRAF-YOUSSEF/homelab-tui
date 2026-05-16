import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, useApp, useInput } from "ink";
import { Monitor, PassphraseRequiredError } from "../core/monitor.js";
import {
  restartDockerService,
  startDockerService,
  stopDockerService,
  getDockerLogs,
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
  passphrase?: string;
  onSwitchHost: () => void;
  onNeedPassphrase: () => void;
};

export function App({ hostConfig, passphrase, onSwitchHost, onNeedPassphrase }: Readonly<Props>) {
  const { exit } = useApp();
  const monitorRef = useRef<Monitor | null>(null);

  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [logs, setLogs] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const services: Service[] = snapshot?.services ?? [];
  const selectedService: Service | null = services[selectedIndex] ?? null;

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
      .connect(passphrase)
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
  }, [hostConfig, passphrase, doRefresh, onNeedPassphrase]);

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

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(services.length - 1, i + 1));
      return;
    }

    if (!selectedService || busy) return;

    if (input === "r") {
      runAction("restart", () => restartDockerService(getRunner(), selectedService));
    } else if (input === "s") {
      runAction("stop", () => stopDockerService(getRunner(), selectedService));
    } else if (input === "t") {
      runAction("start", () => startDockerService(getRunner(), selectedService));
    } else if (input === "l") {
      getDockerLogs(getRunner(), selectedService)
        .then((out) => setLogs(out))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          flash(`logs failed: ${msg}`, true);
        });
    } else if (input === "L") {
      setLogs(null);
    }
  });

  const error = snapshot?.error ?? actionError ?? null;

  return (
    <Box flexDirection="column" width="100%">
      <Header snapshot={snapshot} connecting={connecting} lastUpdated={lastUpdated} />
      {snapshot?.system && <SystemPanel system={snapshot.system} />}
      <ServiceList services={services} selectedIndex={selectedIndex} />
      <ServiceDetails service={selectedService} />
      <LogPanel logs={logs} serviceName={selectedService?.name ?? null} />
      <Footer actionMessage={actionMessage} error={error} />
    </Box>
  );
}
