import type { SystemInfo } from "../core/types.js";

export async function getSystemInfo(
  run: (cmd: string) => Promise<string>
): Promise<SystemInfo> {
  let hostname = "unknown";
  try { hostname = await run("hostname"); } catch {}

  let cpuUsagePercent: number | undefined;
  try {
    const out = await run(
      "top -l 1 -s 0 | grep 'CPU usage' | awk '{print $3}' | tr -d '%'"
    );
    const v = Number.parseFloat(out.trim());
    if (!Number.isNaN(v)) cpuUsagePercent = Math.round(v);
  } catch {}

  let ram: SystemInfo["ram"];
  try {
    const totalOut = await run("sysctl -n hw.memsize");
    const statOut = await run("vm_stat");
    const totalBytes = Number(totalOut.trim());
    const pageSize = 4096;
    const freeMatch = statOut.match(/Pages free:\s+(\d+)/);
    const inactiveMatch = statOut.match(/Pages inactive:\s+(\d+)/);
    if (
      !Number.isNaN(totalBytes) &&
      freeMatch &&
      inactiveMatch
    ) {
      const freePages = Number(freeMatch[1]) + Number(inactiveMatch[1]);
      const usedBytes = totalBytes - freePages * pageSize;
      ram = { totalBytes, usedBytes };
    }
  } catch {}

  let disks: SystemInfo["disks"];
  try {
    const out = await run("df -k / | tail -1 | awk '{print $2,$4}'");
    const [total, free] = out.trim().split(" ").map((v) => Number(v) * 1024);
    if (!Number.isNaN(total) && !Number.isNaN(free)) {
      disks = [{ name: "/", totalBytes: total, freeBytes: free }];
    }
  } catch {}

  return { hostname, os: "macos", cpuUsagePercent, ram, disks };
}
