import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { HostConfig } from "../core/types.js";

type Props = {
  onSubmit: (host: HostConfig) => void;
  onCancel?: () => void;
};

type Field = "name" | "host" | "port" | "username" | "privateKeyPath" | "docker" | "stopped";

const FIELDS: Field[] = ["name", "host", "port", "username", "privateKeyPath", "docker", "stopped"];

const LABELS: Record<Field, string> = {
  name: "Display name",
  host: "Host / IP address",
  port: "SSH port",
  username: "Username",
  privateKeyPath: "Private key path",
  docker: "Docker discovery",
  stopped: "Include stopped containers",
};

export function HostForm({ onSubmit, onCancel = () => {} }: Readonly<Props>) {
  const [focusIndex, setFocusIndex] = useState(0);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [privateKeyPath, setPrivateKeyPath] = useState("~/.ssh/id_ed25519");
  const [docker, setDocker] = useState(true);
  const [stopped, setStopped] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentField = FIELDS[focusIndex];
  const isBoolean = currentField === "docker" || currentField === "stopped";

  useInput((_input, key) => {
    if (key.escape) { onCancel(); return; }

    if (key.tab || (key.downArrow && isBoolean)) {
      setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
      return;
    }
    if (key.shift && key.tab || key.upArrow && isBoolean) {
      setFocusIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (isBoolean) {
      if (_input === " ") {
        if (currentField === "docker") setDocker((v) => !v);
        if (currentField === "stopped") setStopped((v) => !v);
      }
      if (key.return) trySubmit();
    }
  });

  function trySubmit() {
    const portNum = Number.parseInt(port, 10);
    if (!name.trim()) { setError("Name required"); return; }
    if (!host.trim()) { setError("Host required"); return; }
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) { setError("Invalid port"); return; }
    if (!username.trim()) { setError("Username required"); return; }
    if (!privateKeyPath.trim()) { setError("Key path required"); return; }
    setError(null);
    onSubmit({
      name: name.trim(),
      host: host.trim(),
      port: portNum,
      username: username.trim(),
      privateKeyPath: privateKeyPath.trim(),
      discovery: { docker, nativeServices: false, includeStoppedContainers: stopped },
    });
  }

  function handleSubmit(field: Field) {
    if (field !== "privateKeyPath") {
      setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
      return;
    }
    trySubmit();
  }

  const values: Record<Field, string> = {
    name, host, port, username, privateKeyPath,
    docker: docker ? "yes" : "no",
    stopped: stopped ? "yes" : "no",
  };

  const setters: Partial<Record<Field, (v: string) => void>> = {
    name: setName,
    host: setHost,
    port: setPort,
    username: setUsername,
    privateKeyPath: setPrivateKeyPath,
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold color="cyan">Add host</Text>
        <Text> </Text>

        {FIELDS.map((field, i) => {
          const focused = i === focusIndex;
          const isBool = field === "docker" || field === "stopped";

          return (
            <Box key={field} marginBottom={0}>
              <Text color={focused ? "white" : "gray"}>
                {LABELS[field].padEnd(28)}
              </Text>
              {isBool ? (
                <Text color={focused ? "cyan" : "gray"}>
                  [{values[field]}]{focused ? "  (space to toggle)" : ""}
                </Text>
              ) : (
                <TextInput
                  value={values[field]}
                  onChange={setters[field]!}
                  onSubmit={() => handleSubmit(field)}
                  focus={focused}
                  mask={field === "privateKeyPath" ? undefined : undefined}
                />
              )}
            </Box>
          );
        })}

        {error && <Text color="red">{error}</Text>}
        <Text> </Text>
        <Box gap={2}>
          <Text dimColor><Text color="cyan">Tab</Text> next field</Text>
          <Text dimColor><Text color="cyan">Enter</Text> confirm / save</Text>
          <Text dimColor><Text color="cyan">Space</Text> toggle</Text>
          <Text dimColor><Text color="cyan">Esc</Text> cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}
