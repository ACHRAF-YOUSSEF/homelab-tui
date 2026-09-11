import React from "react";
import { Box, Text } from "ink";
import type { Service, ServiceStatus, StatusChange } from "../core/types.js";
import { palette, statusColor } from "./palette.js";

const STATUS_ICON: Record<ServiceStatus, string> = {
  running: "●", stopped: "○", restarting: "↻", failed: "✗", unknown: "?",
};

type Props = {
  service: Service | null;
  history?: Map<string, StatusChange[]>;
  paneLabel?: string;
  containerWidth?: number;
  compact?: boolean;
};

export function ServiceDetails({ service, history, paneLabel, containerWidth = 80, compact = false }: Readonly<Props>) {
  if (!service) {
    return (
      <Box borderStyle="single" borderColor={palette.inactive} paddingX={1} width="100%">
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

  if (compact) {
    return (
      <Box borderStyle="single" borderColor={palette.inactive} paddingX={1} width="100%">
        <Text bold color={palette.inactive}>Details  </Text>
        <Box flexGrow={1}>
          <Text wrap="truncate">{service.name} · {service.status} · {kindLabel} · {service.ports ?? service.image ?? "—"}</Text>
        </Box>
      </Box>
    );
  }

  const stacked = containerWidth < 72;
  const innerWidth = Math.max(20, containerWidth - 4);
  const columnWidth = stacked ? innerWidth : Math.floor(innerWidth / 2);
  const columns = stacked ? [rows] : [left, right];

  return (
    <Box borderStyle="single" borderColor={palette.inactive} paddingX={1} width="100%" flexDirection="column">
      <Box>
        <Text bold color={palette.inactive}>Details</Text>
        {paneLabel && <Text dimColor>  ({paneLabel})</Text>}
      </Box>
      <Box flexDirection={stacked ? "column" : "row"}>
        {columns.map((column, columnIndex) => (
          <Box key={columnIndex} flexDirection="column" width={columnWidth}>
            {column.map(([label, value]) => (
              <Box key={label} width={columnWidth}>
                <Box width={16}><Text dimColor wrap="truncate">{label}</Text></Box>
                <Box width={Math.max(1, columnWidth - 16)}><Text wrap="truncate">{value}</Text></Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>

      {changes.length > 0 && (
        <Box gap={1} flexWrap="wrap">
          <Text dimColor bold>history</Text>
          {[...changes].reverse().map((c, i) => (
            <Text key={i} color={statusColor[c.status]}>
              {STATUS_ICON[c.status]} {c.status} <Text dimColor>{c.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</Text>
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
