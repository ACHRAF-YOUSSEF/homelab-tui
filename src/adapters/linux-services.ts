import type { Service, ServiceStatus } from "../core/types.js";

function mapStatus(active: string, sub: string): ServiceStatus {
  if (active === "active" && sub === "running") return "running";
  if (active === "failed") return "failed";
  if (active === "activating" || active === "deactivating") return "restarting";
  if (active === "active") return "running"; // active+exited (oneshot)
  return "stopped";
}

export async function getNativeServices(
  run: (cmd: string) => Promise<string>
): Promise<Service[]> {
  try {
    // --no-legend removes the header/footer lines
    const out = await run(
      "systemctl list-units --type=service --all --no-pager --plain --no-legend 2>/dev/null"
    );
    if (!out.trim()) return [];

    return out
      .trim()
      .split("\n")
      .flatMap((line): Service[] => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) return [];
        const [unit, , active, sub] = parts;
        const name = unit.replace(/\.service$/, "");
        if (!name) return [];
        return [{
          id: `systemd:${name}`,
          name,
          kind: "system-service",
          status: mapStatus(active, sub),
        }];
      });
  } catch {
    return [];
  }
}
