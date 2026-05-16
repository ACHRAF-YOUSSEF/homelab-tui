import React from "react";
import { Box, Text, useInput } from "ink";
import type { HostConfig } from "../core/types.js";

type Props = {
  hosts: HostConfig[];
  onSelect: (host: HostConfig) => void;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
};

export function HostSelector({ hosts, onSelect, onAdd, onEdit, onDelete }: Readonly<Props>) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const clamped = Math.min(selectedIndex, Math.max(0, hosts.length - 1));

  useInput((input, key) => {
    if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) setSelectedIndex((i) => Math.min(hosts.length - 1, i + 1));
    if (key.return && hosts.length > 0) onSelect(hosts[clamped]);
    if (input === "a") onAdd();
    if (input === "e" && hosts.length > 0) onEdit(clamped);
    if (input === "d" && hosts.length > 0) onDelete(clamped);
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold color="cyan">homelab-tui  —  select host</Text>
        <Text> </Text>

        {hosts.length === 0 ? (
          <Text dimColor>No hosts configured. Press <Text color="cyan">a</Text> to add one.</Text>
        ) : (
          hosts.map((h, i) => {
            const selected = i === clamped;
            return (
              <Box key={h.name}>
                <Text bold={selected} inverse={selected} color={selected ? "white" : "gray"}>
                  {selected ? "> " : "  "}
                  {h.name.padEnd(20)}
                  {"  "}
                  <Text dimColor={!selected}>{h.username}@{h.host}:{h.port}</Text>
                </Text>
              </Box>
            );
          })
        )}

        <Text> </Text>
        <Box gap={2}>
          <Text dimColor><Text color="cyan">↑↓</Text> select</Text>
          <Text dimColor><Text color="cyan">Enter</Text> connect</Text>
          <Text dimColor><Text color="cyan">a</Text> add</Text>
          <Text dimColor><Text color="cyan">e</Text> edit</Text>
          <Text dimColor><Text color="cyan">d</Text> delete</Text>
        </Box>
      </Box>
    </Box>
  );
}
