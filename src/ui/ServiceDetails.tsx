import React from "react";
import { Box, Text } from "ink";
import type { Service } from "../core/types.js";

type Props = { service: Service | null };

export function ServiceDetails({ service }: Readonly<Props>) {
  if (!service) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>No service selected.</Text>
      </Box>
    );
  }

  const rows: [string, string][] = [
    ["ID", service.id],
    ["Name", service.name],
    ["Kind", service.kind],
    ["Status", service.status],
    ["Image", service.image ?? "—"],
    ["Ports", service.ports ?? "—"],
    ["Health", service.health ?? "—"],
  ];
  if (service.composeProject) rows.push(["Compose Project", service.composeProject]);
  if (service.composeService) rows.push(["Compose Service", service.composeService]);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
      <Text bold color="gray">Details</Text>
      {rows.map(([label, value]) => (
        <Box key={label}>
          <Text dimColor>{label.padEnd(18)}</Text>
          <Text>{value}</Text>
        </Box>
      ))}
    </Box>
  );
}
