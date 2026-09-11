import React, { useEffect, useState } from "react";
import { Box, Text, TextInput } from "./tui.js";
import type { Service, ServiceStatus } from "../core/types.js";
import type { SortField, StatusFilter } from "./App.js";
import { getServiceColumns } from "./geometry.js";
import { palette, statusColor } from "./palette.js";

const VIEW_HEIGHT = 12;
const PREFIX = 4;   // selector (2) + icon (2)
const STATUS_ICON: Record<ServiceStatus, string> = {
  running: "●", stopped: "○", restarting: "↻", failed: "✗", unknown: "?",
};

function shortPorts(ports: string | undefined): string {
  if (!ports) return "—";
  // Docker format: "0.0.0.0:8080->80/tcp" → extract host port
  const dockerPorts = [...ports.matchAll(/:(\d+)->/g)].map((m) => m[1]);
  if (dockerPorts.length) return [...new Set(dockerPorts)].join(", ");
  // Process discovery format: plain "8096, 11434"
  return ports.length > 24 ? `${ports.slice(0, 22)}…` : ports;
}

type Props = {
  services: Service[];
  allCount: number;
  selectedIndex: number;
  searchQuery: string;
  searchMode: boolean;
  statusFilter: StatusFilter;
  sortBy: SortField;
  filterKey: string;
  containerWidth?: number;
  viewHeight?: number;
  emptyMessage?: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
};

export function ServiceList({
  services, allCount, selectedIndex,
  searchQuery, searchMode, statusFilter, sortBy, filterKey, containerWidth,
  viewHeight = VIEW_HEIGHT,
  emptyMessage = "No services match.",
  onSearchChange, onSearchSubmit,
}: Readonly<Props>) {
  const [scrollTop, setScrollTop] = useState(0);
  const cols = getServiceColumns(containerWidth ?? process.stdout.columns ?? 80);
  const visibleRows = Math.max(1, viewHeight);

  // Reset scroll instantly when filter/sort/search changes
  useEffect(() => { setScrollTop(0); }, [filterKey]);

  useEffect(() => {
    setScrollTop((prev) => {
      if (selectedIndex < prev) return selectedIndex;
      if (selectedIndex >= prev + visibleRows) return selectedIndex - visibleRows + 1;
      return prev;
    });
  }, [selectedIndex, visibleRows]);

  const visible = services.slice(scrollTop, scrollTop + visibleRows);
  const canScrollUp = scrollTop > 0;
  const canScrollDown = scrollTop + visibleRows < services.length;
  const position = services.length === 0
    ? "0"
    : `${scrollTop + 1}–${Math.min(scrollTop + visibleRows, services.length)} of ${services.length}`;

  const filterLabel = statusFilter === "all" ? "" : ` [${statusFilter === "native" ? "processes" : statusFilter}]`;
  const sortLabel   = sortBy === "name"      ? "" : ` [↕${sortBy}]`;

  return (
    <Box borderStyle="single" borderColor={palette.services} paddingX={1} width="100%" flexDirection="column">

      {/* Title */}
      <Box>
        <Text bold color={palette.services}>
          Services ({allCount}{services.length !== allCount ? `→${services.length}` : ""})
        </Text>
        <Text color={palette.services}>{filterLabel}</Text>
        <Text dimColor>{sortLabel}</Text>
        <Text>{"  "}</Text>
        {canScrollUp   && <Text color={palette.services}>↑ </Text>}
        {canScrollDown && <Text color={palette.services}>↓ </Text>}
        <Text dimColor>{position}</Text>
      </Box>

      {/* Search bar */}
      {searchMode ? (
        <Box>
          <Text color={palette.structure}>/ </Text>
          <TextInput value={searchQuery} onChange={onSearchChange} onSubmit={onSearchSubmit} focus placeholder="type to search…" />
        </Box>
      ) : searchQuery ? (
        <Box>
          <Text dimColor>search: </Text><Text color={palette.structure}>{searchQuery}</Text>
          <Text dimColor>  (/ to edit, Esc to clear)</Text>
        </Box>
      ) : null}

      {/* Column headers */}
      <Box>
        <Box width={PREFIX} />
        <Box width={cols.name}><Text bold dimColor>NAME</Text></Box>
        <Box width={cols.status}><Text bold dimColor>STATUS</Text></Box>
        {cols.image > 0 && <Box width={cols.image}><Text bold dimColor>IMAGE</Text></Box>}
        {cols.ports > 0 && <Box width={cols.ports}><Text bold dimColor>PORTS</Text></Box>}
      </Box>

      {/* Rows */}
      {services.length === 0 ? (
        <Text dimColor>{emptyMessage}</Text>
      ) : (
        visible.map((svc, i) => {
          const absIndex = scrollTop + i;
          const selected = absIndex === selectedIndex;
          const sc = statusColor[svc.status];
          const icon = STATUS_ICON[svc.status];

          return (
            <Box key={svc.id}>
              <Box width={2}>
                <Text color={selected ? palette.selected : palette.inactive} bold={selected}>{selected ? "> " : "  "}</Text>
              </Box>
              <Box width={2}>
                <Text color={sc}>{icon} </Text>
              </Box>
              <Box width={cols.name}>
                <Text color={selected ? palette.selected : undefined} bold={selected} inverse={selected} wrap="truncate">
                  {svc.name}
                </Text>
              </Box>
              <Box width={cols.status}>
                <Text color={sc} wrap="truncate">{svc.status}</Text>
              </Box>
              {cols.image > 0 && (
                <Box width={cols.image}>
                  <Text dimColor wrap="truncate">{svc.image ?? "—"}</Text>
                </Box>
              )}
              {cols.ports > 0 && (
                <Box width={cols.ports}>
                  <Text dimColor wrap="truncate">{shortPorts(svc.ports)}</Text>
                </Box>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
}
