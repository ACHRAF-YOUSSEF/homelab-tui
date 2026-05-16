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

type Props = { system: SystemInfo };

export function SystemPanel({ system }: Readonly<Props>) {
  const ramPct =
    system.ram
      ? Math.round((system.ram.usedBytes / system.ram.totalBytes) * 100)
      : null;

  return (
    <Box borderStyle="single" borderColor="blue" paddingX={1} marginBottom={0}>
      <Box flexDirection="column">
        <Text bold color="blue">System</Text>
        <Box gap={3}>
          {system.cpuUsagePercent !== undefined && (
            <Text>
              <Text dimColor>CPU </Text>
              <Text color={system.cpuUsagePercent > 80 ? "red" : system.cpuUsagePercent > 50 ? "yellow" : "green"}>
                {bar(system.cpuUsagePercent)} {system.cpuUsagePercent}%
              </Text>
            </Text>
          )}
          {ramPct !== null && system.ram && (
            <Text>
              <Text dimColor>RAM </Text>
              <Text color={ramPct > 80 ? "red" : ramPct > 50 ? "yellow" : "green"}>
                {bar(ramPct)} {fmtBytes(system.ram.usedBytes)}/{fmtBytes(system.ram.totalBytes)}
              </Text>
            </Text>
          )}
          {system.disks?.slice(0, 2).map((d) => {
            const used = d.totalBytes - d.freeBytes;
            const pct = Math.round((used / d.totalBytes) * 100);
            return (
              <Text key={d.name}>
                <Text dimColor>{d.name} </Text>
                <Text color={pct > 80 ? "red" : pct > 50 ? "yellow" : "green"}>
                  {bar(pct)} {fmtBytes(used)}/{fmtBytes(d.totalBytes)}
                </Text>
              </Text>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
