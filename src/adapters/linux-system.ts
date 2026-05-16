import type { SystemInfo } from "../core/types.js";

export async function getSystemInfo(
  run: (cmd: string) => Promise<string>
): Promise<SystemInfo> {
  let hostname = "unknown";
  try { hostname = await run("hostname"); } catch {}

  let cpuUsagePercent: number | undefined;
  try {
    // Read /proc/stat twice 1s apart and compute idle delta
    const read = () => run("cat /proc/stat | head -1");
    const parse = (line: string) => line.split(/\s+/).slice(1).map(Number);
    const before = parse(await read());
    await new Promise((r) => setTimeout(r, 200));
    const after = parse(await read());
    const totalBefore = before.reduce((a, b) => a + b, 0);
    const totalAfter = after.reduce((a, b) => a + b, 0);
    const idleBefore = before[3];
    const idleAfter = after[3];
    const totalDiff = totalAfter - totalBefore;
    const idleDiff = idleAfter - idleBefore;
    if (totalDiff > 0) {
      cpuUsagePercent = Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
    }
  } catch {}

  let ram: SystemInfo["ram"];
  try {
    const out = await run("free -b | awk 'NR==2{print $2,$3}'");
    const [total, used] = out.trim().split(" ").map(Number);
    if (!Number.isNaN(total) && !Number.isNaN(used)) {
      ram = { totalBytes: total, usedBytes: used };
    }
  } catch {}

  let disks: SystemInfo["disks"];
  try {
    const out = await run("df -B1 --output=target,size,avail | tail -n +2");
    const parsed = out
      .trim()
      .split("\n")
      .map((line) => {
        const [name, total, free] = line.trim().split(/\s+/);
        return { name, totalBytes: Number(total), freeBytes: Number(free) };
      })
      .filter((d) => !Number.isNaN(d.totalBytes) && !Number.isNaN(d.freeBytes));
    if (parsed.length > 0) disks = parsed;
  } catch {}

  return { hostname, os: "linux", cpuUsagePercent, ram, disks };
}
