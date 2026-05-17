import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { HostConfig } from "../core/types.js";

type Props = {
  hosts: HostConfig[];
  onSelect: (host: HostConfig) => void;
  onMultiSelect: (hosts: HostConfig[]) => void;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onBack?: () => void;
};

export function HostSelector({ hosts, onSelect, onMultiSelect, onAdd, onEdit, onDelete, onBack }: Readonly<Props>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [multiMode, setMultiMode] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  // Unique groups from all hosts, preserving insertion order
  const groups = useMemo(() => {
    const seen = new Set<string>();
    for (const h of hosts) {
      if (h.group) seen.add(h.group);
    }
    return [...seen];
  }, [hosts]);

  // Hosts visible under current group filter
  const visibleHosts = useMemo(
    () => groupFilter ? hosts.filter((h) => h.group === groupFilter) : hosts,
    [hosts, groupFilter]
  );

  const clamped = Math.min(selectedIndex, Math.max(0, visibleHosts.length - 1));

  const toggleChecked = (i: number) =>
    setChecked((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });

  const cycleGroup = () => {
    if (groups.length === 0) return;
    setSelectedIndex(0);
    if (groupFilter === null) {
      setGroupFilter(groups[0] ?? null);
    } else {
      const idx = groups.indexOf(groupFilter);
      setGroupFilter(idx >= groups.length - 1 ? null : groups[idx + 1] ?? null);
    }
  };

  useInput((input, key) => {
    if (key.upArrow) { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setSelectedIndex((i) => Math.min(visibleHosts.length - 1, i + 1)); return; }

    if (multiMode) {
      if (input === " ") { toggleChecked(clamped); return; }
      if (key.escape) { setMultiMode(false); setChecked(new Set()); return; }
      if (key.return) {
        const selected = visibleHosts.filter((_, i) => checked.has(i));
        if (selected.length >= 1) onMultiSelect(selected);
        return;
      }
    } else {
      if (key.escape && onBack) { onBack(); return; }
      if (key.return && visibleHosts.length > 0) { onSelect(visibleHosts[clamped]!); return; }
      if (input === "m" && visibleHosts.length > 1) { setMultiMode(true); setChecked(new Set([clamped])); return; }
      if (input === "g" && groups.length > 0) { cycleGroup(); return; }
      if (input === "a") { onAdd(); return; }
      if (input === "e" && visibleHosts.length > 0) {
        const realIdx = hosts.indexOf(visibleHosts[clamped]!);
        onEdit(realIdx);
        return;
      }
      if (input === "d" && visibleHosts.length > 0) {
        const realIdx = hosts.indexOf(visibleHosts[clamped]!);
        onDelete(realIdx);
        return;
      }
    }
  });

  const title = multiMode
    ? `select hosts (${checked.size} selected)`
    : groupFilter ? `group: ${groupFilter}` : "select host";

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column">
        <Box gap={2}>
          <Text bold color="cyan">homelab-tui  —  {title}</Text>
          {groupFilter && <Text dimColor>({visibleHosts.length}/{hosts.length} hosts)</Text>}
        </Box>
        <Text> </Text>

        {visibleHosts.length === 0 ? (
          <Text dimColor>No hosts configured. Press <Text color="cyan">a</Text> to add one.</Text>
        ) : (
          visibleHosts.map((h, i) => {
            const isCurrent = i === clamped;
            const isChecked = checked.has(i);
            return (
              <Box key={h.name} gap={1}>
                <Text bold={isCurrent} color={isCurrent ? "white" : "gray"}>{isCurrent ? ">" : " "}</Text>
                {multiMode && (
                  <Text color={isChecked ? "cyan" : "gray"}>{isChecked ? "[✓]" : "[ ]"}</Text>
                )}
                <Text bold={isCurrent} inverse={isCurrent} color={isCurrent ? "white" : "gray"}>
                  {h.name.padEnd(20)}
                </Text>
                {h.group && !groupFilter && (
                  <Text color="magenta" dimColor>[{h.group}]</Text>
                )}
                <Text dimColor>{h.username}@{h.host}:{h.port}</Text>
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
            {visibleHosts.length > 1 && <Text dimColor><Text color="cyan">m</Text> multi-host</Text>}
            {groups.length > 0 && <Text dimColor><Text color="cyan">g</Text> group</Text>}
            <Text dimColor><Text color="cyan">a</Text> add</Text>
            <Text dimColor><Text color="cyan">e</Text> edit</Text>
            <Text dimColor><Text color="cyan">d</Text> delete</Text>
            {onBack && <Text dimColor><Text color="cyan">Esc</Text> back</Text>}
          </Box>
        )}
      </Box>
    </Box>
  );
}
