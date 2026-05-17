import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { Service, ServiceStatus } from "../core/types.js";
import type { SortField, StatusFilter } from "./App.js";

const VIEW_HEIGHT = 12;
const PADDING = 2;  
const PREFIX = 4;   // selector (2) + icon (2)

// Proportional column widths — must sum to 1.0
const RATIOS = { name: 0.28, status: 0.12, image: 0.35, ports: 0.25 };

function getColWidths() {
  const total = Math.max(40, (process.stdout.columns ?? 80) - PADDING - PREFIX);
  const name   = Math.floor(total * RATIOS.name);
  const status = Math.floor(total * RATIOS.status);
  const image  = Math.floor(total * RATIOS.image);
  const ports  = total - name - status - image;
  return { name, status, image, ports };
}

const STATUS_COLOR: Record<ServiceStatus, string> = {
  running: "green", stopped: "gray", restarting: "yellow", failed: "red", unknown: "gray",
};
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
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
};

export function ServiceList({
  services, allCount, selectedIndex,
  searchQuery, searchMode, statusFilter, sortBy, filterKey,
  onSearchChange, onSearchSubmit,
}: Readonly<Props>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [cols, setCols] = useState(getColWidths);

  // Reset scroll instantly when filter/sort/search changes
  useEffect(() => { setScrollTop(0); }, [filterKey]);

  // Recalculate on resize
  useEffect(() => {
    const onResize = () => setCols(getColWidths());
    process.stdout.on("resize", onResize);
    return () => { process.stdout.off("resize", onResize); };
  }, []);

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

  const filterLabel = statusFilter === "all" ? "" : ` [${statusFilter === "native" ? "processes" : statusFilter}]`;
  const sortLabel   = sortBy === "name"      ? "" : ` [↕${sortBy}]`;

  return (
    <Box borderStyle="single" borderColor="magenta" paddingX={1} width="100%" flexDirection="column">

      {/* Title */}
      <Box>
        <Text bold color="magenta">
          Services ({allCount}{services.length !== allCount ? `→${services.length}` : ""})
        </Text>
        <Text color="magenta">{filterLabel}</Text>
        <Text dimColor>{sortLabel}</Text>
        <Text>{"  "}</Text>
        {canScrollUp   && <Text color="magenta">↑ </Text>}
        {canScrollDown && <Text color="magenta">↓ </Text>}
        <Text dimColor>{position}</Text>
      </Box>

      {/* Search bar */}
      {searchMode ? (
        <Box>
          <Text color="cyan">/ </Text>
          <TextInput value={searchQuery} onChange={onSearchChange} onSubmit={onSearchSubmit} focus placeholder="type to search…" />
        </Box>
      ) : searchQuery ? (
        <Box>
          <Text dimColor>search: </Text><Text color="cyan">{searchQuery}</Text>
          <Text dimColor>  (/ to edit, Esc to clear)</Text>
        </Box>
      ) : null}

      {/* Column headers */}
      <Box>
        <Box width={PREFIX} />
        <Box width={cols.name}><Text bold dimColor>NAME</Text></Box>
        <Box width={cols.status}><Text bold dimColor>STATUS</Text></Box>
        <Box width={cols.image}><Text bold dimColor>IMAGE</Text></Box>
        <Box width={cols.ports}><Text bold dimColor>PORTS</Text></Box>
      </Box>

      {/* Rows */}
      {services.length === 0 ? (
        <Text dimColor>No services match.</Text>
      ) : (
        visible.map((svc, i) => {
          const absIndex = scrollTop + i;
          const selected = absIndex === selectedIndex;
          const sc = STATUS_COLOR[svc.status];
          const icon = STATUS_ICON[svc.status];

          return (
            <Box key={svc.id}>
              <Box width={2}>
                <Text color={selected ? "white" : "gray"} bold={selected}>{selected ? "> " : "  "}</Text>
              </Box>
              <Box width={2}>
                <Text color={sc}>{icon} </Text>
              </Box>
              <Box width={cols.name}>
                <Text color={selected ? "white" : undefined} bold={selected} inverse={selected} wrap="truncate">
                  {svc.name}
                </Text>
              </Box>
              <Box width={cols.status}>
                <Text color={sc} wrap="truncate">{svc.status}</Text>
              </Box>
              <Box width={cols.image}>
                <Text dimColor wrap="truncate">{svc.image ?? "—"}</Text>
              </Box>
              <Box width={cols.ports}>
                <Text dimColor wrap="truncate">{shortPorts(svc.ports)}</Text>
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );
}
