import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { Service, ServiceStatus } from "../core/types.js";
import type { SortField, StatusFilter } from "./App.js";

const VIEW_HEIGHT = 12;

// Column widths
const COL_NAME = 26;
const COL_STATUS = 11;
const COL_IMAGE = 30;

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

function shortPorts(ports: string | undefined): string {
  if (!ports) return "—";
  // Show only unique host ports, e.g. "8080, 6881"
  const matches = [...ports.matchAll(/:(\d+)->/g)].map((m) => m[1]);
  const unique = [...new Set(matches)];
  return unique.length ? unique.join(", ") : ports.slice(0, 20);
}

type Props = {
  services: Service[];
  allCount: number;
  selectedIndex: number;
  searchQuery: string;
  searchMode: boolean;
  statusFilter: StatusFilter;
  sortBy: SortField;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
};

export function ServiceList({
  services,
  allCount,
  selectedIndex,
  searchQuery,
  searchMode,
  statusFilter,
  sortBy,
  onSearchChange,
  onSearchSubmit,
}: Readonly<Props>) {
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setScrollTop((prev) => {
      if (selectedIndex < prev) return selectedIndex;
      if (selectedIndex >= prev + VIEW_HEIGHT) return selectedIndex - VIEW_HEIGHT + 1;
      return prev;
    });
  }, [selectedIndex]);

  const visible = services.slice(scrollTop, scrollTop + VIEW_HEIGHT);
  const canScrollUp = scrollTop > 0;
  const canScrollDown = scrollTop + VIEW_HEIGHT < services.length;
  const position = services.length === 0
    ? "0"
    : `${scrollTop + 1}–${Math.min(scrollTop + VIEW_HEIGHT, services.length)} of ${services.length}`;

  const filterLabel = statusFilter === "all" ? "" : ` [${statusFilter}]`;
  const sortLabel = sortBy === "name" ? "" : ` [↕${sortBy}]`;

  return (
    <Box borderStyle="single" borderColor="magenta" paddingX={1} flexDirection="column">

      {/* Title row */}
      <Box>
        <Text bold color="magenta">
          Services ({allCount}
          {services.length !== allCount ? `→${services.length}` : ""})
        </Text>
        <Text color="magenta">{filterLabel}</Text>
        <Text dimColor>{sortLabel}</Text>
        <Text>{"  "}</Text>
        {canScrollUp && <Text color="magenta">↑ </Text>}
        {canScrollDown && <Text color="magenta">↓ </Text>}
        <Text dimColor>{position}</Text>
      </Box>

      {/* Search bar */}
      {searchMode ? (
        <Box>
          <Text color="cyan">/ </Text>
          <TextInput
            value={searchQuery}
            onChange={onSearchChange}
            onSubmit={onSearchSubmit}
            focus={searchMode}
            placeholder="type to search…"
          />
        </Box>
      ) : searchQuery ? (
        <Box>
          <Text dimColor>search: </Text>
          <Text color="cyan">{searchQuery}</Text>
          <Text dimColor>  (/ to edit, Esc to clear)</Text>
        </Box>
      ) : null}

      {/* Column headers */}
      <Box>
        <Box width={4} />
        <Box width={COL_NAME}><Text bold dimColor>NAME</Text></Box>
        <Box width={COL_STATUS}><Text bold dimColor>STATUS</Text></Box>
        <Box width={COL_IMAGE}><Text bold dimColor>IMAGE</Text></Box>
        <Box flexGrow={1}><Text bold dimColor>PORTS</Text></Box>
      </Box>

      {/* Rows */}
      {services.length === 0 ? (
        <Text dimColor>No services match.</Text>
      ) : (
        visible.map((svc, i) => {
          const absIndex = scrollTop + i;
          const selected = absIndex === selectedIndex;
          const statusColor = STATUS_COLOR[svc.status];
          const icon = STATUS_ICON[svc.status];
          const ports = shortPorts(svc.ports);

          return (
            <Box key={svc.id}>
              <Box width={2}>
                <Text color={selected ? "white" : "gray"} bold={selected}>
                  {selected ? "> " : "  "}
                </Text>
              </Box>
              <Box width={2}>
                <Text color={statusColor}>{icon} </Text>
              </Box>
              <Box width={COL_NAME}>
                <Text
                  color={selected ? "white" : undefined}
                  bold={selected}
                  inverse={selected}
                  wrap="truncate"
                >
                  {svc.name}
                </Text>
              </Box>
              <Box width={COL_STATUS}>
                <Text color={statusColor} wrap="truncate">
                  {svc.status}
                </Text>
              </Box>
              <Box width={COL_IMAGE}>
                <Text dimColor wrap="truncate">
                  {svc.image ?? "—"}
                </Text>
              </Box>
              <Box flexGrow={1}>
                <Text dimColor wrap="truncate">
                  {ports}
                </Text>
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );
}
