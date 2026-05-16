import React, { useState, useCallback } from "react";
import { HostSelector } from "./HostSelector.js";
import { HostForm } from "./HostForm.js";
import { CredentialPrompt } from "./CredentialPrompt.js";
import { App } from "./App.js";
import { saveConfig } from "../config/loader.js";
import type { ConnectOptions } from "../transports/ssh.js";
import type { AppConfig, HostConfig } from "../core/types.js";

type Screen =
  | { kind: "selector" }
  | { kind: "form" }
  | { kind: "credential"; host: HostConfig; mode: "password" | "passphrase" }
  | { kind: "monitor"; host: HostConfig; connectOptions?: ConnectOptions };

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
    if (host.authMethod === "password") {
      setScreen({ kind: "credential", host, mode: "password" });
    } else {
      setScreen({ kind: "monitor", host });
    }
  }, []);

  const handleAddHost = useCallback(() => setScreen({ kind: "form" }), []);

  const handleDeleteHost = useCallback((index: number) => {
    const next = { hosts: config.hosts.filter((_, i) => i !== index) };
    persistConfig(next);
    if (next.hosts.length === 0) setScreen({ kind: "form" });
  }, [config, persistConfig]);

  const handleFormSubmit = useCallback((host: HostConfig) => {
    const next = { hosts: [...config.hosts, host] };
    persistConfig(next);
    handleSelectHost(host);
  }, [config, persistConfig, handleSelectHost]);

  const handleFormCancel = useCallback(() => setScreen({ kind: "selector" }), []);

  const handleSwitchHost = useCallback(() => setScreen({ kind: "selector" }), []);

  const handleNeedPassphrase = useCallback(() => {
    if (screen.kind === "monitor") {
      setScreen({ kind: "credential", host: screen.host, mode: "passphrase" });
    }
  }, [screen]);

  const handleCredentialSubmit = useCallback((value: string) => {
    if (screen.kind !== "credential") return;
    const opts: ConnectOptions =
      screen.mode === "password" ? { password: value } : { passphrase: value };
    setScreen({ kind: "monitor", host: screen.host, connectOptions: opts });
  }, [screen]);

  const handleCredentialCancel = useCallback(() => setScreen({ kind: "selector" }), []);

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

  // screen.kind === "monitor"
  return (
    <App
      hostConfig={screen.host}
      connectOptions={screen.connectOptions}
      onSwitchHost={handleSwitchHost}
      onNeedPassphrase={handleNeedPassphrase}
    />
  );
}
