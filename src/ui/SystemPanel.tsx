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

function Metric({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <Box gap={1}>
      <Text dimColor>{label}</Text>
      {children}
    </Box>
  );
}

function DiskBar({ d }: Readonly<{ d: DiskEntry }>) {
  const used = d.totalBytes - d.freeBytes;
  const pct = Math.round((used / d.totalBytes) * 100);
  return (
    <Metric label={d.name}>
      <Text color={clr(pct)}>
        {pct >= 85 ? "⚠ " : ""}{bar(pct)} {fmtBytes(used)}/{fmtBytes(d.totalBytes)} ({pct}%)
      </Text>
    </Metric>
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
      <Box justifyContent="space-between">
        {/* CPU */}
        {system.cpuUsagePercent !== undefined && (
          <Metric label="CPU">
            <Text color={clr(system.cpuUsagePercent)}>
              {bar(system.cpuUsagePercent)} {system.cpuUsagePercent}%
            </Text>
          </Metric>
        )}

        {/* RAM */}
        {ramPct !== null && system.ram && (
          <Metric label="RAM">
            <Text color={clr(ramPct)}>
              {bar(ramPct)} {fmtBytes(system.ram.usedBytes)}/{fmtBytes(system.ram.totalBytes)}
            </Text>
          </Metric>
        )}

        {/* Disks inline — wrap if too many */}
        {disks.map((d) => <DiskBar key={d.name} d={d} />)}
      </Box>
    </Box>
  );
}
