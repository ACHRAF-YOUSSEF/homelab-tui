import React from "react";
import { Box, Text } from "ink";
import type { Service, ServiceStatus } from "../core/types.js";

const STATUS_COLOR: Record<ServiceStatus, string> = {
  running: "green",
  stopped: "gray",
  restarting: "yellow",
  failed: "red",
  unknown: "gray",
};

const STATUS_ICON: Record<ServiceStatus, string> = {
  running: "●",
  stopped: "○",
  restarting: "↻",
  failed: "✗",
  unknown: "?",
};

type Props = {
  services: Service[];
  selectedIndex: number;
};

export function ServiceList({ services, selectedIndex }: Readonly<Props>) {
  if (services.length === 0) {
    return (
      <Box borderStyle="single" borderColor="magenta" paddingX={1}>
        <Text dimColor>No containers found.</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor="magenta" paddingX={1} flexDirection="column">
      <Text bold color="magenta">Services ({services.length})</Text>
      {services.map((svc, i) => {
        const selected = i === selectedIndex;
        const color = STATUS_COLOR[svc.status];
        const icon = STATUS_ICON[svc.status];
        const prefix = selected ? "> " : "  ";
        const project = svc.composeProject ? `[${svc.composeProject}] ` : "";

        return (
          <Box key={svc.id}>
            <Text
              color={selected ? "white" : "gray"}
              bold={selected}
              inverse={selected}
            >
              {prefix}
              <Text color={color}>{icon} </Text>
              <Text>{project}</Text>
              <Text>{svc.name.padEnd(30)}</Text>
              {"  "}
              <Text dimColor>{svc.image?.slice(0, 30) ?? "—"}</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
