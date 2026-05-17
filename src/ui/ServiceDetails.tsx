import React from "react";
import { Box, Text } from "ink";
import type { Service, ServiceStatus, StatusChange } from "../core/types.js";

const STATUS_COLOR: Record<ServiceStatus, string> = {
  running: "green", stopped: "gray", restarting: "yellow", failed: "red", unknown: "gray",
};
const STATUS_ICON: Record<ServiceStatus, string> = {
  running: "●", stopped: "○", restarting: "↻", failed: "✗", unknown: "?",
};

type Props = {
  service: Service | null;
  history?: Map<string, StatusChange[]>;
  paneLabel?: string;
};

export function ServiceDetails({ service, history, paneLabel }: Readonly<Props>) {
  if (!service) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1} width="100%">
        <Text dimColor>No service selected.</Text>
      </Box>
    );
  }

  const isProcess = service.kind === "system-service";
  const pid = isProcess ? service.id.replace(/^proc:/, "") : null;

  const kindLabel = service.kind === "system-service" ? "process"
    : service.kind === "docker-compose" ? "docker-compose"
    : "docker";

  const rows: [string, string][] = [
    ["ID", pid ? `pid ${pid}` : service.id],
    ["Name", service.name],
    ["Kind", kindLabel],
    ["Status", service.status],
    ["Ports", service.ports ?? "—"],
    ["Image", service.image ?? "—"],
    ["Health", service.health ?? "—"],
  ];
  if (service.composeProject) rows.push(["Compose Project", service.composeProject]);
  if (service.composeService) rows.push(["Compose Service", service.composeService]);

  const mid = Math.ceil(rows.length / 2);
  const left = rows.slice(0, mid);
  const right = rows.slice(mid);

  const changes = history?.get(service.id) ?? [];

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} width="100%" flexDirection="column">
      <Box>
        <Text bold color="gray">Details</Text>
        {paneLabel && <Text dimColor>  ({paneLabel})</Text>}
      </Box>
      <Box>
        {/* Left / right detail columns */}
        <Box flexDirection="column" flexGrow={1}>
          {left.map(([label, value]) => (
            <Box key={label}>
              <Text dimColor>{label.padEnd(16)}</Text>
              <Text>{value}</Text>
            </Box>
          ))}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {right.map(([label, value]) => (
            <Box key={label}>
              <Text dimColor>{label.padEnd(16)}</Text>
              <Text>{value}</Text>
            </Box>
          ))}
        </Box>

        {/* Status history — shown when at least one change exists */}
        {changes.length > 0 && (
          <Box flexDirection="column" marginLeft={2}>
            <Text dimColor bold>history</Text>
            {[...changes].reverse().map((c, i) => (
              <Box key={i} gap={1}>
                <Text color={STATUS_COLOR[c.status]}>{STATUS_ICON[c.status]}</Text>
                <Text color={STATUS_COLOR[c.status]}>{c.status.padEnd(10)}</Text>
                <Text dimColor>{c.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
