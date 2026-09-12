import React from "react";
import { Box, Text } from "./tui.js";
import type { SystemInfo } from "../core/types.js";
import { palette } from "./palette.js";

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
  return pct > 80 ? palette.danger : pct > 50 ? palette.warning : palette.healthy;
}

type DiskEntry = { name: string; totalBytes: number; freeBytes: number };

function Metric({ label, children, truncateLabel = false }: Readonly<{ label: string; children: React.ReactNode; truncateLabel?: boolean }>) {
  return (
    <Box gap={1} flexShrink={truncateLabel ? 1 : 0} overflow="hidden">
      <Box flexShrink={truncateLabel ? 1 : 0} overflow="hidden"><Text dimColor wrap="truncate">{label}</Text></Box>
      <Box flexShrink={0} overflow="hidden">{children}</Box>
    </Box>
  );
}

function DiskBar({ d, compact }: Readonly<{ d: DiskEntry; compact?: boolean }>) {
  const used = d.totalBytes - d.freeBytes;
  const pct = Math.round((used / d.totalBytes) * 100);
  return (
    <Metric label={d.name} truncateLabel>
      <Text color={clr(pct)}>
        {pct >= 85 ? "⚠ " : ""}{compact ? `${fmtBytes(used)}/${fmtBytes(d.totalBytes)} ${pct}%` : `${bar(pct)} ${fmtBytes(used)}/${fmtBytes(d.totalBytes)} (${pct}%)`}
      </Text>
    </Metric>
  );
}

type Props = { system: SystemInfo; compact?: boolean; containerWidth?: number };

export function SystemPanel({ system, compact, containerWidth = 80 }: Readonly<Props>) {
  const ramPct = system.ram
    ? Math.round((system.ram.usedBytes / system.ram.totalBytes) * 100)
    : null;

  const disks = system.disks ?? [];
  const maxDisks = Math.max(0, Math.floor((containerWidth - (compact ? 50 : 65)) / (compact ? 28 : 45)));
  const visibleDisks = disks.slice(0, maxDisks);
  const hiddenDisks = disks.length - visibleDisks.length;

  return (
    <Box borderStyle="single" borderColor={palette.metrics} paddingX={1} width="100%" flexDirection="column" flexShrink={0}>
      <Box justifyContent="space-between" gap={compact ? 2 : undefined} overflow="hidden">
        {/* CPU */}
        {system.cpuUsagePercent !== undefined && (
          <Metric label="CPU">
            <Text color={clr(system.cpuUsagePercent)}>
              {compact ? `${system.cpuUsagePercent}%` : `${bar(system.cpuUsagePercent)} ${system.cpuUsagePercent}%`}
            </Text>
          </Metric>
        )}

        {/* RAM */}
        {ramPct !== null && system.ram && (
          <Metric label="RAM">
            <Text color={clr(ramPct)}>
              {compact ? `${fmtBytes(system.ram.usedBytes)}/${fmtBytes(system.ram.totalBytes)}` : `${bar(ramPct)} ${fmtBytes(system.ram.usedBytes)}/${fmtBytes(system.ram.totalBytes)}`}
            </Text>
          </Metric>
        )}

        {/* Disks inline — wrap if too many */}
        {visibleDisks.map((d) => <DiskBar key={d.name} d={d} compact={compact} />)}
        {hiddenDisks > 0 && <Text dimColor>+{hiddenDisks} disk{hiddenDisks === 1 ? "" : "s"}</Text>}
      </Box>
    </Box>
  );
}
