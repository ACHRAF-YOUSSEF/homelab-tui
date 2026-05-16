import React, { useState, useCallback } from "react";
import { HostSelector } from "./HostSelector.js";
import { HostForm } from "./HostForm.js";
import { CredentialPrompt } from "./CredentialPrompt.js";
import { ConfigSetup } from "./ConfigSetup.js";
import { App } from "./App.js";
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
  | { kind: "monitor"; host: HostConfig; connectOptions?: ConnectOptions };

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

  const persistConfig = useCallback((next: AppConfig, path = currentConfigPath) => {
    setConfig(next);
    try { saveConfig(next, path); } catch {}
  }, [currentConfigPath]);

  // ── ConfigSetup callbacks ─────────────────────────────────────────────────
  const handleConfigReady = useCallback((path: string) => {
    setCurrentConfigPath(path);
    const settings = loadSettings();
    settings.configPath = path;
    saveSettings(settings);
    const loaded = loadConfig(path) ?? { hosts: [] };
    setConfig(loaded);
    setScreen(loaded.hosts.length === 0 ? { kind: "form" } : { kind: "selector" });
  }, []);

  // ── HostSelector callbacks ────────────────────────────────────────────────
  const handleSelectHost = useCallback((host: HostConfig) => {
    if (host.authMethod === "password") {
      setScreen({ kind: "credential", host, mode: "password" });
    } else {
      setScreen({ kind: "monitor", host });
    }
  }, []);

  const handleAddHost = useCallback(() => setScreen({ kind: "form" }), []);

  const handleEditHost = useCallback((index: number) => {
    setScreen({ kind: "form-edit", index });
  }, []);

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

  // ── HostForm callbacks ────────────────────────────────────────────────────
  const handleFormSubmit = useCallback((host: HostConfig) => {
    const next = { hosts: [...config.hosts, host] };
    persistConfig(next);
    handleSelectHost(host);
  }, [config, persistConfig, handleSelectHost]);

  const handleFormCancel = useCallback(() => setScreen({ kind: "selector" }), []);

  // ── Monitor callbacks ─────────────────────────────────────────────────────
  const handleSwitchHost = useCallback(() => setScreen({ kind: "selector" }), []);

  const handleNeedPassphrase = useCallback(() => {
    if (screen.kind === "monitor") {
      setScreen({ kind: "credential", host: screen.host, mode: "passphrase" });
    }
  }, [screen]);

  // ── CredentialPrompt callbacks ────────────────────────────────────────────
  const handleCredentialSubmit = useCallback((value: string) => {
    if (screen.kind !== "credential") return;
    const opts: ConnectOptions =
      screen.mode === "password" ? { password: value } : { passphrase: value };
    setScreen({ kind: "monitor", host: screen.host, connectOptions: opts });
  }, [screen]);

  const handleCredentialCancel = useCallback(() => setScreen({ kind: "selector" }), []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (screen.kind === "setup") {
    return <ConfigSetup defaultPath={currentConfigPath} onConfigReady={handleConfigReady} />;
  }

  if (screen.kind === "selector") {
    return (
      <HostSelector
        hosts={config.hosts}
        onSelect={handleSelectHost}
        onAdd={handleAddHost}
        onEdit={handleEditHost}
        onDelete={handleDeleteHost}
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

  return (
    <App
      hostConfig={screen.host}
      connectOptions={screen.connectOptions}
      onSwitchHost={handleSwitchHost}
      onNeedPassphrase={handleNeedPassphrase}
    />
  );
}
