import React from "react";
import { Box, Text } from "ink";
import type { MonitorSnapshot } from "../core/types.js";

type Props = {
  snapshot: MonitorSnapshot | null;
  connecting: boolean;
  lastUpdated: Date | null;
};

export function Header({ snapshot, connecting, lastUpdated }: Readonly<Props>) {
  const time = lastUpdated
    ? lastUpdated.toLocaleTimeString()
    : "—";

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={0}>
      <Box flexGrow={1}>
        <Text bold color="cyan">
          homelab-tui
        </Text>
        {snapshot && (
          <Text>
            {"  "}
            <Text dimColor>host: </Text>
            <Text color="white">{snapshot.hostName}</Text>
            {"  "}
            <Text dimColor>os: </Text>
            <Text color="white">{snapshot.remoteOS}</Text>
            {"  "}
            <Text dimColor>node: </Text>
            <Text color="white">{snapshot.system.hostname}</Text>
          </Text>
        )}
        {connecting && <Text color="yellow">  connecting…</Text>}
      </Box>
      <Text dimColor>updated: {time}</Text>
    </Box>
  );
}
