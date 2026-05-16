import React, { useState, useCallback } from "react";
import { HostSelector } from "./HostSelector.js";
import { HostForm } from "./HostForm.js";
import { PassphrasePrompt } from "./PassphrasePrompt.js";
import { App } from "./App.js";
import { loadConfig, saveConfig } from "../config/loader.js";
import type { AppConfig, HostConfig } from "../core/types.js";

type Screen =
  | { kind: "selector" }
  | { kind: "form" }
  | { kind: "passphrase"; host: HostConfig }
  | { kind: "monitor"; host: HostConfig; passphrase?: string };

function getInitialScreen(config: AppConfig): Screen {
  if (config.hosts.length === 0) return { kind: "form" };
  return { kind: "selector" };
}

type Props = { initialConfig: AppConfig };

export function Root({ initialConfig }: Readonly<Props>) {
  const [config, setConfig] = useState<AppConfig>(initialConfig);
  const [screen, setScreen] = useState<Screen>(getInitialScreen(initialConfig));

  const persistConfig = useCallback((next: AppConfig) => {
    setConfig(next);
    try { saveConfig(next); } catch {}
  }, []);

  const handleSelectHost = useCallback((host: HostConfig) => {
    setScreen({ kind: "monitor", host });
  }, []);

  const handleAddHost = useCallback(() => {
    setScreen({ kind: "form" });
  }, []);

  const handleDeleteHost = useCallback((index: number) => {
    const next = { hosts: config.hosts.filter((_, i) => i !== index) };
    persistConfig(next);
    if (next.hosts.length === 0) setScreen({ kind: "form" });
  }, [config, persistConfig]);

  const handleFormSubmit = useCallback((host: HostConfig) => {
    const next = { hosts: [...config.hosts, host] };
    persistConfig(next);
    setScreen({ kind: "monitor", host });
  }, [config, persistConfig]);

  const handleFormCancel = useCallback(() => {
    setScreen({ kind: "selector" });
  }, []);

  const handleSwitchHost = useCallback(() => {
    setScreen({ kind: "selector" });
  }, []);

  const handleNeedPassphrase = useCallback(() => {
    if (screen.kind === "monitor") {
      setScreen({ kind: "passphrase", host: screen.host });
    }
  }, [screen]);

  const handlePassphraseSubmit = useCallback((passphrase: string) => {
    if (screen.kind === "passphrase") {
      setScreen({ kind: "monitor", host: screen.host, passphrase });
    }
  }, [screen]);

  const handlePassphraseCancel = useCallback(() => {
    setScreen({ kind: "selector" });
  }, []);

  if (screen.kind === "selector") {
    return (
      <HostSelector
        hosts={config.hosts}
        onSelect={handleSelectHost}
        onAdd={handleAddHost}
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

  if (screen.kind === "passphrase") {
    return (
      <PassphrasePrompt
        host={screen.host}
        onSubmit={handlePassphraseSubmit}
        onCancel={handlePassphraseCancel}
      />
    );
  }

  // screen.kind === "monitor"
  return (
    <App
      hostConfig={screen.host}
      passphrase={screen.passphrase}
      onSwitchHost={handleSwitchHost}
      onNeedPassphrase={handleNeedPassphrase}
    />
  );
}
