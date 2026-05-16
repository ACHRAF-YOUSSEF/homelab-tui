import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { Service, ServiceStatus } from "../core/types.js";

const VIEW_HEIGHT = 12;

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
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setScrollTop((prev) => {
      if (selectedIndex < prev) return selectedIndex;
      if (selectedIndex >= prev + VIEW_HEIGHT) return selectedIndex - VIEW_HEIGHT + 1;
      return prev;
    });
  }, [selectedIndex]);

  if (services.length === 0) {
    return (
      <Box borderStyle="single" borderColor="magenta" paddingX={1}>
        <Text dimColor>No containers found.</Text>
      </Box>
    );
  }

  const visible = services.slice(scrollTop, scrollTop + VIEW_HEIGHT);
  const canScrollUp = scrollTop > 0;
  const canScrollDown = scrollTop + VIEW_HEIGHT < services.length;

  return (
    <Box borderStyle="single" borderColor="magenta" paddingX={1} flexDirection="column">
      <Box>
        <Text bold color="magenta">Services ({services.length})</Text>
        <Text>{"  "}</Text>
        {canScrollUp && <Text color="magenta">↑ </Text>}
        {canScrollDown && <Text color="magenta">↓ </Text>}
        <Text dimColor>
          {scrollTop + 1}–{Math.min(scrollTop + VIEW_HEIGHT, services.length)} of {services.length}
        </Text>
      </Box>

      {visible.map((svc, i) => {
        const absIndex = scrollTop + i;
        const selected = absIndex === selectedIndex;
        const color = STATUS_COLOR[svc.status];
        const icon = STATUS_ICON[svc.status];
        const project = svc.composeProject ? `[${svc.composeProject}] ` : "";

        return (
          <Box key={svc.id}>
            <Text color={selected ? "white" : "gray"} bold={selected} inverse={selected}>
              {selected ? "> " : "  "}
              <Text color={color}>{icon} </Text>
              <Text>{project}</Text>
              <Text>{svc.name.padEnd(30)}</Text>
              {"  "}
              <Text dimColor>{svc.image?.slice(0, 35) ?? "—"}</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
