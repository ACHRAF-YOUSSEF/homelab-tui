import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { HostConfig } from "../core/types.js";

type Props = {
  hosts: HostConfig[];
  onSelect: (host: HostConfig) => void;
  onMultiSelect: (hosts: HostConfig[]) => void;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
};

export function HostSelector({ hosts, onSelect, onMultiSelect, onAdd, onEdit, onDelete }: Readonly<Props>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [multiMode, setMultiMode] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const clamped = Math.min(selectedIndex, Math.max(0, hosts.length - 1));

  const toggleChecked = (i: number) =>
    setChecked((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });

  useInput((input, key) => {
    if (key.upArrow) { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setSelectedIndex((i) => Math.min(hosts.length - 1, i + 1)); return; }

    if (multiMode) {
      if (input === " ") { toggleChecked(clamped); return; }
      if (key.escape) { setMultiMode(false); setChecked(new Set()); return; }
      if (key.return) {
        const selected = hosts.filter((_, i) => checked.has(i));
        if (selected.length >= 1) onMultiSelect(selected);
        return;
      }
    } else {
      if (key.return && hosts.length > 0) { onSelect(hosts[clamped]); return; }
      if (input === "m" && hosts.length > 1) { setMultiMode(true); setChecked(new Set([clamped])); return; }
      if (input === "a") { onAdd(); return; }
      if (input === "e" && hosts.length > 0) { onEdit(clamped); return; }
      if (input === "d" && hosts.length > 0) { onDelete(clamped); return; }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column">
        <Text bold color="cyan">
          homelab-tui  —  {multiMode ? `select hosts (${checked.size} selected)` : "select host"}
        </Text>
        <Text> </Text>

        {hosts.length === 0 ? (
          <Text dimColor>No hosts configured. Press <Text color="cyan">a</Text> to add one.</Text>
        ) : (
          hosts.map((h, i) => {
            const isCurrent = i === clamped;
            const isChecked = checked.has(i);
            return (
              <Box key={h.name}>
                <Text bold={isCurrent} color={isCurrent ? "white" : "gray"}>
                  {isCurrent ? "> " : "  "}
                  {multiMode && (
                    <Text color={isChecked ? "cyan" : "gray"}>{isChecked ? "[✓] " : "[ ] "}</Text>
                  )}
                  <Text inverse={isCurrent}>{h.name.padEnd(20)}</Text>
                  {"  "}
                  <Text dimColor={!isCurrent}>{h.username}@{h.host}:{h.port}</Text>
                </Text>
              </Box>
            );
          })
        )}

        <Text> </Text>
        {multiMode ? (
          <Box gap={2}>
            <Text dimColor><Text color="cyan">↑↓</Text> navigate</Text>
            <Text dimColor><Text color="cyan">Space</Text> select</Text>
            <Text dimColor><Text color="cyan">Enter</Text> connect selected</Text>
            <Text dimColor><Text color="cyan">Esc</Text> cancel</Text>
          </Box>
        ) : (
          <Box gap={2}>
            <Text dimColor><Text color="cyan">↑↓</Text> select</Text>
            <Text dimColor><Text color="cyan">Enter</Text> connect</Text>
            {hosts.length > 1 && <Text dimColor><Text color="cyan">m</Text> multi-host</Text>}
            <Text dimColor><Text color="cyan">a</Text> add</Text>
            <Text dimColor><Text color="cyan">e</Text> edit</Text>
            <Text dimColor><Text color="cyan">d</Text> delete</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
