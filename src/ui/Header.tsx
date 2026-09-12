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
  compact?: boolean;
  // Omit these when rendering inside MultiMonitor's app bar (which already shows them)
  version?: string;
  updateTag?: string | null;
};

export function Header({ snapshot, connecting, lastUpdated, reconnectCountdown, reconnectAttempt, compact, version, updateTag }: Readonly<Props>) {
  const time = lastUpdated ? lastUpdated.toLocaleTimeString() : "—";

  return (
    <Box borderStyle="single" borderColor={palette.structure} paddingX={1} width="100%">
      <Box flexGrow={1} overflow="hidden">
        {/* Brand — only when version is provided (not duplicated from app bar) */}
        {version && (
          <Box gap={1} flexShrink={0} marginRight={2}>
            <Text bold color={palette.brand}>homelab-tui</Text>
            <Text dimColor>v{version}</Text>
            {updateTag && <Text color={palette.warning} bold>↑ {updateTag} available</Text>}
          </Box>
        )}

        {snapshot ? (
          <Box flexGrow={1} overflow="hidden">
            <Box flexGrow={1} flexBasis={0} justifyContent="flex-start" overflow="hidden">
              <Text wrap="truncate"><Text dimColor>{compact ? "device " : "host "}</Text><Text color={palette.selected}>{compact ? snapshot.system.hostname : snapshot.hostName}</Text></Text>
            </Box>
            {!compact && (
              <Box flexGrow={1} flexBasis={0} justifyContent="center" overflow="hidden">
                <Text wrap="truncate"><Text dimColor>os </Text><Text color={palette.selected}>{snapshot.remoteOS}</Text></Text>
              </Box>
            )}
            {!compact && (
              <Box flexGrow={1} flexBasis={0} justifyContent="center" overflow="hidden">
                <Text wrap="truncate"><Text dimColor>device </Text><Text color={palette.selected}>{snapshot.system.hostname}</Text></Text>
              </Box>
            )}
            <Box flexGrow={1} flexBasis={0} justifyContent="flex-end" overflow="hidden">
              {reconnectCountdown === null ? (
                <Text dimColor wrap="truncate">updated {time}</Text>
              ) : (
                <Text color={palette.warning} wrap="truncate">reconnecting in {reconnectCountdown}s… (#{reconnectAttempt ?? 1})</Text>
              )}
            </Box>
          </Box>
        ) : (
          <Box flexGrow={1} justifyContent="flex-end">
            <Text color={connecting ? palette.warning : palette.inactive}>
              {connecting ? "connecting…" : "—"}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
