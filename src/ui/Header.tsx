import React from "react";
import { Box, Text } from "ink";
import type { MonitorSnapshot } from "../core/types.js";

type Props = {
  snapshot: MonitorSnapshot | null;
  connecting: boolean;
  lastUpdated: Date | null;
  reconnectCountdown: number | null;
  version: string;
  updateTag?: string | null;
};

export function Header({ snapshot, connecting, lastUpdated, reconnectCountdown, version, updateTag }: Readonly<Props>) {
  const time = lastUpdated ? lastUpdated.toLocaleTimeString() : "—";

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1} width="100%" flexDirection="column">
      <Box flexGrow={1} justifyContent="space-between">
        <Box gap={1}>
          <Text bold color="cyan">homelab-tui</Text>
          <Text dimColor>v{version}</Text>
          {updateTag && (
            <Text color="yellow" bold>↑ {updateTag} available</Text>
          )}
        </Box>

        {snapshot ? (
          <>
            <Text><Text dimColor>host </Text><Text color="white">{snapshot.hostName}</Text></Text>
            <Text><Text dimColor>os </Text><Text color="white">{snapshot.remoteOS}</Text></Text>
            <Text><Text dimColor>node </Text><Text color="white">{snapshot.system.hostname}</Text></Text>
          </>
        ) : (
          <Text color={connecting ? "yellow" : "gray"}>
            {connecting ? "connecting…" : "—"}
          </Text>
        )}

        {reconnectCountdown === null ? (
          <Text dimColor>updated {time}</Text>
        ) : (
          <Text color="yellow">reconnecting in {reconnectCountdown}s…</Text>
        )}
      </Box>
    </Box>
  );
}
