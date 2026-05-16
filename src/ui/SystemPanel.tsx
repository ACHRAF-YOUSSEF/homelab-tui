import React from "react";
import { Box, Text } from "ink";
import type { SystemInfo } from "../core/types.js";

function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)}G`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)}M`;
  return `${bytes}B`;
}

function bar(pct: number, width = 10): string {
  const filled = Math.round((pct / 100) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

function color(pct: number) {
  return pct > 80 ? "red" : pct > 50 ? "yellow" : "green";
}

type Props = { system: SystemInfo };

export function SystemPanel({ system }: Readonly<Props>) {
  const ramPct = system.ram
    ? Math.round((system.ram.usedBytes / system.ram.totalBytes) * 100)
    : null;

  return (
    <Box borderStyle="single" borderColor="blue" paddingX={1} width="100%" flexDirection="column">
      <Text bold color="blue">System</Text>
      <Box justifyContent="space-between">
        {system.cpuUsagePercent !== undefined && (
          <Box gap={1}>
            <Text dimColor>CPU</Text>
            <Text color={color(system.cpuUsagePercent)}>
              {bar(system.cpuUsagePercent)} {system.cpuUsagePercent}%
            </Text>
          </Box>
        )}

        {ramPct !== null && system.ram && (
          <Box gap={1}>
            <Text dimColor>RAM</Text>
            <Text color={color(ramPct)}>
              {bar(ramPct)} {fmtBytes(system.ram.usedBytes)}/{fmtBytes(system.ram.totalBytes)}
            </Text>
          </Box>
        )}

        {system.disks?.map((d) => {
          const used = d.totalBytes - d.freeBytes;
          const pct = Math.round((used / d.totalBytes) * 100);
          return (
            <Box key={d.name} gap={1}>
              <Text dimColor>{d.name}</Text>
              <Text color={color(pct)}>
                {bar(pct)} {fmtBytes(used)}/{fmtBytes(d.totalBytes)}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
