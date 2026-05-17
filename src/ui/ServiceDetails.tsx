import React from "react";
import { Box, Text } from "ink";
import type { Service } from "../core/types.js";

type Props = { service: Service | null };

export function ServiceDetails({ service }: Readonly<Props>) {
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

  // Split into two equal columns
  const mid = Math.ceil(rows.length / 2);
  const left = rows.slice(0, mid);
  const right = rows.slice(mid);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} width="100%" flexDirection="column">
      <Text bold color="gray">Details</Text>
      <Box>
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
      </Box>
    </Box>
  );
}
