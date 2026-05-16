import React from "react";
import { Box, Text } from "ink";
import type { SystemInfo } from "../core/types.js";

function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)}G`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)}M`;
  return `${bytes}B`;
}

function bar(pct: number, width = 8): string {
  const filled = Math.round((pct / 100) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

function clr(pct: number) {
  return pct > 80 ? "red" : pct > 50 ? "yellow" : "green";
}

type DiskEntry = { name: string; totalBytes: number; freeBytes: number };

function DiskBar({ d }: { d: DiskEntry }) {
  const used = d.totalBytes - d.freeBytes;
  const pct = Math.round((used / d.totalBytes) * 100);
  return (
    <Box gap={1} marginRight={2}>
      <Text dimColor>{d.name}</Text>
      <Text color={clr(pct)}>{bar(pct)} {fmtBytes(used)}/{fmtBytes(d.totalBytes)}</Text>
    </Box>
  );
}

type Props = { system: SystemInfo };

export function SystemPanel({ system }: Readonly<Props>) {
  const ramPct = system.ram
    ? Math.round((system.ram.usedBytes / system.ram.totalBytes) * 100)
    : null;

  const disks = system.disks ?? [];

  return (
    <Box borderStyle="single" borderColor="blue" paddingX={1} width="100%" flexDirection="column">
      <Text bold color="blue">System</Text>

      {/* Row 1: CPU + RAM */}
      <Box gap={4}>
        {system.cpuUsagePercent !== undefined && (
          <Box gap={1}>
            <Text dimColor>CPU</Text>
            <Text color={clr(system.cpuUsagePercent)}>
              {bar(system.cpuUsagePercent)} {system.cpuUsagePercent}%
            </Text>
          </Box>
        )}
        {ramPct !== null && system.ram && (
          <Box gap={1}>
            <Text dimColor>RAM</Text>
            <Text color={clr(ramPct)}>
              {bar(ramPct)} {fmtBytes(system.ram.usedBytes)}/{fmtBytes(system.ram.totalBytes)}
            </Text>
          </Box>
        )}
      </Box>

      {/* Row 2: Disks — wrap into multiple rows if many */}
      {disks.length > 0 && (
        <Box flexWrap="wrap">
          {disks.map((d) => <DiskBar key={d.name} d={d} />)}
        </Box>
      )}
    </Box>
  );
}
