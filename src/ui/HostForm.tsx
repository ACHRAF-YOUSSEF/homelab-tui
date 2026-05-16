import React, { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import type { HostConfig } from "../core/types.js";

type Props = {
  onSubmit: (host: HostConfig) => void;
  onCancel?: () => void;
  initialHost?: HostConfig;
};

type AuthMethod = "key" | "password";

type TextField = "name" | "host" | "port" | "username" | "privateKeyPath";
type BoolField = "docker" | "native" | "stopped";
type AuthField = "authMethod";
type Field = TextField | AuthField | BoolField;

const TEXT_LABELS: Record<TextField, string> = {
  name: "Display name",
  host: "Host / IP address",
  port: "SSH port",
  username: "Username",
  privateKeyPath: "Private key path",
};

export function HostForm({ onSubmit, onCancel, initialHost }: Readonly<Props>) {
  const { exit } = useApp();
  const editing = !!initialHost;
  const [name, setName] = useState(initialHost?.name ?? "");
  const [host, setHost] = useState(initialHost?.host ?? "");
  const [port, setPort] = useState(String(initialHost?.port ?? 22));
  const [username, setUsername] = useState(initialHost?.username ?? "");
  const [authMethod, setAuthMethod] = useState<AuthMethod>(initialHost?.authMethod ?? "key");
  const [privateKeyPath, setPrivateKeyPath] = useState(initialHost?.privateKeyPath ?? "~/.ssh/id_ed25519");
  const [docker, setDocker] = useState(initialHost?.discovery.docker ?? true);
  const [native, setNative] = useState(initialHost?.discovery.nativeServices ?? false);
  const [stopped, setStopped] = useState(initialHost?.discovery.includeStoppedContainers ?? true);
  const [error, setError] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  // Build the active field list dynamically based on authMethod
  const fields: Field[] = [
    "name", "host", "port", "username",
    "authMethod",
    ...(authMethod === "key" ? ["privateKeyPath" as Field] : []),
    "docker", "native", "stopped",
  ];

  const currentField = fields[focusIndex];
  const isBool = currentField === "docker" || currentField === "native" || currentField === "stopped";
  const isAuth = currentField === "authMethod";

  const advance = (delta = 1) =>
    setFocusIndex((i) => (i + delta + fields.length) % fields.length);

  useInput((_input, key) => {
    if (key.escape) { onCancel ? onCancel() : exit(); return; }

    // ↑/↓ navigate between ALL fields; Tab also moves forward
    if (key.downArrow || key.tab) { advance(1); return; }
    if (key.upArrow || (key.shift && key.tab)) { advance(-1); return; }

    if (isBool && _input === " ") {
      if (currentField === "docker") setDocker((v) => !v);
      if (currentField === "native") setNative((v) => !v);
      if (currentField === "stopped") setStopped((v) => !v);
    }
    if (isAuth && _input === " ") {
      setAuthMethod((m) => (m === "key" ? "password" : "key"));
      // If switching to password, clamp focus so we don't land on the now-hidden key field
      setFocusIndex((i) => i);
    }
    if ((isBool || isAuth) && key.return) trySubmit();
  });

  function trySubmit() {
    const portNum = Number.parseInt(port, 10);
    if (!name.trim()) { setError("Name required"); return; }
    if (!host.trim()) { setError("Host required"); return; }
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) { setError("Invalid port"); return; }
    if (!username.trim()) { setError("Username required"); return; }
    if (authMethod === "key" && !privateKeyPath.trim()) { setError("Key path required"); return; }
    setError(null);
    onSubmit({
      name: name.trim(),
      host: host.trim(),
      port: portNum,
      username: username.trim(),
      authMethod,
      privateKeyPath: authMethod === "key" ? privateKeyPath.trim() : undefined,
      discovery: { docker, nativeServices: native, includeStoppedContainers: stopped },
    });
  }

  function handleTextSubmit(field: TextField) {
    const isLast =
      (authMethod === "key" && field === "privateKeyPath") ||
      (authMethod === "password" && field === "username");
    if (isLast) { trySubmit(); return; }
    advance(1);
  }

  const textSetters: Record<TextField, (v: string) => void> = {
    name: setName, host: setHost, port: setPort, username: setUsername, privateKeyPath: setPrivateKeyPath,
  };
  const textValues: Record<TextField, string> = {
    name, host, port, username, privateKeyPath,
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold color="cyan">{editing ? "Edit host" : "Add host"}</Text>
        <Text> </Text>

        {fields.map((field, i) => {
          const focused = i === focusIndex;

          if (field === "authMethod") {
            return (
              <Box key="authMethod">
                <Text color={focused ? "white" : "gray"}>{"Auth method".padEnd(28)}</Text>
                <Text color={focused ? "cyan" : "gray"}>
                  [{authMethod}]{focused ? "  (space to toggle)" : ""}
                </Text>
              </Box>
            );
          }

          if (field === "docker" || field === "native" || field === "stopped") {
            const val = field === "docker" ? docker : field === "native" ? native : stopped;
            const label = field === "docker" ? "Docker discovery" : field === "native" ? "Native services" : "Include stopped containers";
            return (
              <Box key={field}>
                <Text color={focused ? "white" : "gray"}>{label.padEnd(28)}</Text>
                <Text color={focused ? "cyan" : "gray"}>
                  [{val ? "yes" : "no"}]{focused ? "  (space to toggle)" : ""}
                </Text>
              </Box>
            );
          }

          const tf = field as TextField;
          return (
            <Box key={tf}>
              <Text color={focused ? "white" : "gray"}>{TEXT_LABELS[tf].padEnd(28)}</Text>
              <TextInput
                value={textValues[tf]}
                onChange={textSetters[tf]}
                onSubmit={() => handleTextSubmit(tf)}
                focus={focused}
              />
            </Box>
          );
        })}

        {error && <Text color="red">{error}</Text>}
        <Text> </Text>
        <Box gap={2}>
          <Text dimColor><Text color="cyan">↑↓/Tab</Text> navigate</Text>
          <Text dimColor><Text color="cyan">Enter</Text> save</Text>
          <Text dimColor><Text color="cyan">Space</Text> toggle</Text>
          {onCancel
            ? <Text dimColor><Text color="cyan">Esc</Text> cancel</Text>
            : <Text dimColor><Text color="cyan">Esc</Text> quit</Text>
          }
        </Box>
      </Box>
    </Box>
  );
}
