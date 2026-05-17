import type { Service } from "../core/types.js";

export async function getNativeServices(
  run: (cmd: string) => Promise<string>
): Promise<Service[]> {
  try {
    // -iTCP: TCP only, -sTCP:LISTEN: only listeners, -P: raw port numbers, -n: no DNS
    const out = await run("lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | tail -n +2");
    if (!out.trim()) return [];

    const seen = new Set<string>();
    const byName = new Map<string, { pid: string; ports: string[] }>();

    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE  NODE  NAME(*:PORT or 127.0.0.1:PORT)
      const parts = trimmed.split(/\s+/);
      if (parts.length < 9) continue;

      const name = parts[0];
      const pid = parts[1];
      const nameCol = parts[8];

      const portMatch = nameCol.match(/:(\d+)$/);
      const port = portMatch?.[1];
      if (!port) continue;

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
