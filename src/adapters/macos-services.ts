import type { Service, ServiceStatus } from "../core/types.js";

export async function getNativeServices(
  run: (cmd: string) => Promise<string>
): Promise<Service[]> {
  try {
    // PID | Status | Label
    const out = await run("launchctl list 2>/dev/null");
    if (!out.trim()) return [];

    return out
      .trim()
      .split("\n")
      .slice(1) // skip header
      .flatMap((line): Service[] => {
        const [pid, exitCode, label] = line.trim().split(/\s+/);
        if (!label) return [];
        const running = pid !== "-" && pid !== "";
        const failed = !running && exitCode !== "0" && exitCode !== "-";
        const status: ServiceStatus = failed ? "failed" : running ? "running" : "stopped";
        return [{
          id: `launchd:${label}`,
          name: label,
          kind: "system-service",
          status,
        }];
      });
  } catch {
    return [];
  }
}
