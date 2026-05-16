import type { SystemInfo } from "../core/types.js";

const ps = (expr: string) =>
  `powershell -NoProfile -Command "${expr}"`;

export async function getSystemInfo(
  run: (cmd: string) => Promise<string>
): Promise<SystemInfo> {
  let hostname = "unknown";
  try { hostname = await run("hostname"); } catch {}

  let cpuUsagePercent: number | undefined;
  try {
    const out = await run(
      ps("(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average")
    );
    const v = Number.parseFloat(out.trim());
    if (!Number.isNaN(v)) cpuUsagePercent = Math.round(v);
  } catch {}

  let ram: SystemInfo["ram"];
  try {
    const out = await run(
      ps("$os=Get-CimInstance Win32_OperatingSystem; Write-Output ($os.TotalVisibleMemorySize*1KB); Write-Output (($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)*1KB)")
    );
    const [totalStr, usedStr] = out.trim().split("\n");
    const totalBytes = Number(totalStr.trim());
    const usedBytes = Number(usedStr.trim());
    if (!Number.isNaN(totalBytes) && !Number.isNaN(usedBytes)) {
      ram = { totalBytes, usedBytes };
    }
  } catch {}

  let disks: SystemInfo["disks"];
  try {
    const out = await run(
      ps("Get-CimInstance Win32_LogicalDisk | ForEach-Object { $_.DeviceID + ' ' + $_.Size + ' ' + $_.FreeSpace }")
    );
    const parsed = out
      .trim()
      .split("\n")
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          name: parts[0],
          totalBytes: Number(parts[1]),
          freeBytes: Number(parts[2]),
        };
      })
      .filter((d) => !Number.isNaN(d.totalBytes) && !Number.isNaN(d.freeBytes) && d.totalBytes > 0);
    if (parsed.length > 0) disks = parsed;
  } catch {}

  return { hostname, os: "windows", cpuUsagePercent, ram, disks };
}
