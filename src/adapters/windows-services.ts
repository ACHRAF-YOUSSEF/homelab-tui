import type { Service, ServiceStatus } from "../core/types.js";

function mapStatus(status: string): ServiceStatus {
  const s = status.toLowerCase();
  if (s === "running") return "running";
  if (s === "stopped") return "stopped";
  if (s === "paused") return "stopped";
  if (s.includes("pending")) return "restarting";
  return "unknown";
}

export async function getNativeServices(
  run: (cmd: string) => Promise<string>
): Promise<Service[]> {
  try {
    const out = await run(
      'powershell -NoProfile -Command "Get-Service | ForEach-Object { $_.Name + \'|\' + $_.DisplayName + \'|\' + $_.Status }"'
    );
    if (!out.trim()) return [];

    return out
      .trim()
      .split("\n")
      .flatMap((line): Service[] => {
        const parts = line.trim().split("|");
        if (parts.length < 3) return [];
        const [name, displayName, status] = parts;
        if (!name.trim()) return [];
        return [{
          id: `winsvc:${name.trim()}`,
          name: displayName.trim() || name.trim(),
          kind: "system-service",
          status: mapStatus(status.trim()),
        }];
      });
  } catch {
    return [];
  }
}
