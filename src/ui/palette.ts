import type { ServiceStatus } from "../core/types.js";

export const palette = {
  brand: "cyan",
  structure: "cyan",
  focus: "cyan",
  selected: "white",
  inactive: "gray",
  metrics: "blue",
  services: "magenta",
  logs: "yellow",
  healthy: "green",
  warning: "yellow",
  danger: "red",
} as const;

export const statusColor: Record<ServiceStatus, string> = {
  running: palette.healthy,
  stopped: palette.inactive,
  restarting: palette.warning,
  failed: palette.danger,
  unknown: palette.inactive,
};
