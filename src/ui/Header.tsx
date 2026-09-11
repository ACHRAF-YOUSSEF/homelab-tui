import React from "react";
import { Box, Text } from "./tui.js";
import type { MonitorSnapshot } from "../core/types.js";
import { palette } from "./palette.js";

type Props = {
  snapshot: MonitorSnapshot | null;
  connecting: boolean;
  lastUpdated: Date | null;
  reconnectCountdown: number | null;
  reconnectAttempt?: number;
  // Omit these when rendering inside MultiMonitor's app bar (which already shows them)
  version?: string;
  updateTag?: string | null;
};

export function Header({ snapshot, connecting, lastUpdated, reconnectCountdown, reconnectAttempt, version, updateTag }: Readonly<Props>) {
  const time = lastUpdated ? lastUpdated.toLocaleTimeString() : "—";

  return (
    <Box borderStyle="single" borderColor={palette.structure} paddingX={1} width="100%">
      <Box flexGrow={1} justifyContent="space-between">
        {/* Brand — only when version is provided (not duplicated from app bar) */}
        {version ? (
          <Box gap={1}>
            <Text bold color={palette.brand}>homelab-tui</Text>
            <Text dimColor>v{version}</Text>
            {updateTag && <Text color={palette.warning} bold>↑ {updateTag} available</Text>}
          </Box>
        ) : (
          <Box />
        )}

        {snapshot ? (
          <>
            <Text><Text dimColor>host </Text><Text color={palette.selected}>{snapshot.hostName}</Text></Text>
            <Text><Text dimColor>os </Text><Text color={palette.selected}>{snapshot.remoteOS}</Text></Text>
            <Text><Text dimColor>node </Text><Text color={palette.selected}>{snapshot.system.hostname}</Text></Text>
          </>
        ) : (
          <Text color={connecting ? palette.warning : palette.inactive}>
            {connecting ? "connecting…" : "—"}
          </Text>
        )}

        {reconnectCountdown === null ? (
          <Text dimColor>updated {time}</Text>
        ) : (
          <Text color={palette.warning}>reconnecting in {reconnectCountdown}s… (#{reconnectAttempt ?? 1})</Text>
        )}
      </Box>
    </Box>
  );
}
