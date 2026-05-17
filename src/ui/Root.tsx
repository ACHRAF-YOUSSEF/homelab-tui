import React, { useState, useCallback, useEffect, useRef } from "react";
import { watch } from "node:fs";
import { HostSelector } from "./HostSelector.js";
import { HostForm } from "./HostForm.js";
import { CredentialPrompt } from "./CredentialPrompt.js";
import { ConfigSetup } from "./ConfigSetup.js";
import { MultiMonitor } from "./MultiMonitor.js";
import { loadConfig, saveConfig } from "../config/loader.js";
import { saveSettings, loadSettings } from "../config/settings.js";
import type { ConnectOptions } from "../transports/ssh.js";
import type { AppConfig, HostConfig } from "../core/types.js";

type Screen =
  | { kind: "setup" }
  | { kind: "selector" }
  | { kind: "form" }
  | { kind: "form-edit"; index: number }
  | { kind: "credential"; host: HostConfig; mode: "password" | "passphrase" }
  | { kind: "monitor"; host: HostConfig; connectOptions?: ConnectOptions }
  | {
      kind: "multi-credential";
      hosts: HostConfig[];
      currentIdx: number;            // which host we're prompting for now
      collected: (ConnectOptions | undefined)[];
    }
  | { kind: "multi-monitor"; hosts: HostConfig[]; connectOptions: (ConnectOptions | undefined)[] };

function getInitialScreen(config: AppConfig, configMissing: boolean): Screen {
  if (configMissing) return { kind: "setup" };
  if (config.hosts.length === 0) return { kind: "form" };
  return { kind: "selector" };
}

type Props = {
  initialConfig: AppConfig;
  configPath: string;
  configMissing?: boolean;
};

export function Root({ initialConfig, configPath, configMissing = false }: Readonly<Props>) {
  const [config, setConfig] = useState<AppConfig>(initialConfig);
  const [currentConfigPath, setCurrentConfigPath] = useState(configPath);
  const [screen, setScreen] = useState<Screen>(getInitialScreen(initialConfig, configMissing));
  const [previousMonitorScreen, setPreviousMonitorScreen] = useState<Screen | null>(null);

  const persistConfig = useCallback((next: AppConfig, path = currentConfigPath) => {
    setConfig(next);
    try { saveConfig(next, path); } catch {}
  }, [currentConfigPath]);

  // ── Config hot-reload ─────────────────────────────────────────────────────
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let watcher: ReturnType<typeof watch> | null = null;
    try {
      watcher = watch(currentConfigPath, () => {
        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = setTimeout(() => {
          try {
            const next = loadConfig(currentConfigPath);
            if (next) setConfig(next);
          } catch {}
        }, 150);
      });
    } catch {}
    return () => {
      watcher?.close();
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [currentConfigPath]);

  // ── ConfigSetup ───────────────────────────────────────────────────────────
  const handleConfigReady = useCallback((path: string) => {
    setCurrentConfigPath(path);
    const settings = loadSettings();
    settings.configPath = path;
    saveSettings(settings);
    const loaded = loadConfig(path) ?? { hosts: [] };
    setConfig(loaded);
    setScreen(loaded.hosts.length === 0 ? { kind: "form" } : { kind: "selector" });
  }, []);

  // ── HostSelector ──────────────────────────────────────────────────────────
  const handleSelectHost = useCallback((host: HostConfig) => {
    if (host.authMethod === "password") {
      setScreen({ kind: "credential", host, mode: "password" });
    } else {
      setScreen({ kind: "monitor", host });
    }
  }, []);

  // Start credential collection for multi-host, then launch MultiMonitor
  const handleMultiSelect = useCallback((hosts: HostConfig[]) => {
    const collected: (ConnectOptions | undefined)[] = new Array(hosts.length).fill(undefined);
    // Find first host that needs a credential prompt
    const firstPasswordIdx = hosts.findIndex((h) => h.authMethod === "password");
    if (firstPasswordIdx === -1) {
      // All key auth — launch directly
      setScreen({ kind: "multi-monitor", hosts, connectOptions: collected });
    } else {
      setScreen({ kind: "multi-credential", hosts, currentIdx: firstPasswordIdx, collected });
    }
  }, []);

  const handleAddHost = useCallback(() => setScreen({ kind: "form" }), []);

  const handleEditHost = useCallback((index: number) => setScreen({ kind: "form-edit", index }), []);

  const handleFormEditSubmit = useCallback((index: number, host: HostConfig) => {
    const next = { hosts: config.hosts.map((h, i) => i === index ? host : h) };
    persistConfig(next);
    handleSelectHost(host);
  }, [config, persistConfig, handleSelectHost]);

  const handleDeleteHost = useCallback((index: number) => {
    const next = { hosts: config.hosts.filter((_, i) => i !== index) };
    persistConfig(next);
    if (next.hosts.length === 0) setScreen({ kind: "form" });
  }, [config, persistConfig]);

  // ── HostForm ──────────────────────────────────────────────────────────────
  const handleFormSubmit = useCallback((host: HostConfig) => {
    const next = { hosts: [...config.hosts, host] };
    persistConfig(next);
    handleSelectHost(host);
  }, [config, persistConfig, handleSelectHost]);

  const handleFormCancel = useCallback(() => setScreen({ kind: "selector" }), []);

  // ── Monitor ───────────────────────────────────────────────────────────────
  const handleSwitchHost = useCallback(() => {
    if (screen.kind === "monitor" || screen.kind === "multi-monitor") {
      setPreviousMonitorScreen(screen);
    }
    setScreen({ kind: "selector" });
  }, [screen]);

  const handleBackToMonitor = useCallback(() => {
    if (previousMonitorScreen) {
      setScreen(previousMonitorScreen);
      setPreviousMonitorScreen(null);
    }
  }, [previousMonitorScreen]);

  // ── CredentialPrompt (single host) ────────────────────────────────────────
  const handleCredentialSubmit = useCallback((value: string) => {
    if (screen.kind !== "credential") return;
    const opts: ConnectOptions =
      screen.mode === "password" ? { password: value } : { passphrase: value };
    setScreen({ kind: "monitor", host: screen.host, connectOptions: opts });
  }, [screen]);

  const handleCredentialCancel = useCallback(() => setScreen({ kind: "selector" }), []);

  // ── CredentialPrompt (multi-host sequential) ──────────────────────────────
  const handleMultiCredentialSubmit = useCallback((value: string) => {
    if (screen.kind !== "multi-credential") return;
    const { hosts, currentIdx, collected } = screen;

    const updated = [...collected];
    updated[currentIdx] = { password: value };

    // Find next host that needs a credential
    const nextIdx = hosts.findIndex((h, i) => i > currentIdx && h.authMethod === "password");
    if (nextIdx === -1) {
      // Done collecting — launch
      setScreen({ kind: "multi-monitor", hosts, connectOptions: updated });
    } else {
      setScreen({ kind: "multi-credential", hosts, currentIdx: nextIdx, collected: updated });
    }
  }, [screen]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (screen.kind === "setup") {
    return <ConfigSetup defaultPath={currentConfigPath} onConfigReady={handleConfigReady} />;
  }

  if (screen.kind === "selector") {
    return (
      <HostSelector
        hosts={config.hosts}
        onSelect={handleSelectHost}
        onMultiSelect={handleMultiSelect}
        onAdd={handleAddHost}
        onEdit={handleEditHost}
        onDelete={handleDeleteHost}
        onBack={previousMonitorScreen ? handleBackToMonitor : undefined}
      />
    );
  }

  if (screen.kind === "form") {
    return (
      <HostForm
        onSubmit={handleFormSubmit}
        onCancel={config.hosts.length > 0 ? handleFormCancel : undefined}
      />
    );
  }

  if (screen.kind === "form-edit") {
    const idx = screen.index;
    return (
      <HostForm
        initialHost={config.hosts[idx]}
        onSubmit={(host) => handleFormEditSubmit(idx, host)}
        onCancel={handleFormCancel}
      />
    );
  }

  if (screen.kind === "credential") {
    return (
      <CredentialPrompt
        host={screen.host}
        mode={screen.mode}
        onSubmit={handleCredentialSubmit}
        onCancel={handleCredentialCancel}
      />
    );
  }

  if (screen.kind === "multi-credential") {
    const host = screen.hosts[screen.currentIdx];
    const total = screen.hosts.filter((h) => h.authMethod === "password").length;
    const done = screen.collected.filter((c) => c !== undefined).length;
    return (
      <CredentialPrompt
        key={screen.currentIdx}
        host={host}
        mode="password"
        prompt={total > 1 ? `Password for ${host.name} (${done + 1}/${total})` : undefined}
        onSubmit={handleMultiCredentialSubmit}
        onCancel={handleCredentialCancel}
      />
    );
  }

  if (screen.kind === "multi-monitor") {
    return (
      <MultiMonitor
        initialHosts={screen.hosts}
        initialConnectOptions={screen.connectOptions}
        allHosts={config.hosts}
        onSwitchHost={handleSwitchHost}
      />
    );
  }

  // Single host — also goes through MultiMonitor so "a" can add more panes
  return (
    <MultiMonitor
      initialHosts={[screen.host]}
      initialConnectOptions={[screen.connectOptions]}
      allHosts={config.hosts}
      onSwitchHost={handleSwitchHost}
    />
  );
}
