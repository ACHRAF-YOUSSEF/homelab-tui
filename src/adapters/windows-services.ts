import type { Service } from "../core/types.js";

export async function getNativeServices(
  run: (cmd: string) => Promise<string>
): Promise<Service[]> {
  try {
    // Get listening TCP connections with owning process names
    const cmd = `powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -EA SilentlyContinue | ForEach-Object { try { $p = Get-Process -Id $_.OwningProcess -EA Stop; Write-Output ($p.Name + '|' + $_.LocalPort + '|' + $_.OwningProcess) } catch {} } | Sort-Object -Unique"`;
    const out = await run(cmd);
    if (!out.trim()) return [];

    const seen = new Set<string>();
    const byName = new Map<string, { pid: string; ports: string[] }>();

    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split("|");
      if (parts.length < 3) continue;

      const [name, port, pid] = parts.map(p => p.trim());
      if (!name || !port) continue;

      const key = `${name}:${port}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = byName.get(name);
      if (existing) {
        existing.ports.push(port);
      } else {
        byName.set(name, { pid, ports: [port] });
      }
    }

    return Array.from(byName.entries()).map(([name, { pid, ports }]) => ({
      id: `proc:${pid}`,
      name,
      kind: "system-service",
      status: "running",
      ports: ports.join(", "),
    } satisfies Service));
  } catch {
    return [];
  }
}
