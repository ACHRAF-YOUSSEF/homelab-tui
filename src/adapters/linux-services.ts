import type { Service } from "../core/types.js";

export async function getNativeServices(
  run: (cmd: string) => Promise<string>
): Promise<Service[]> {
  try {
    // ss -tlnp: TCP listening sockets with process info (requires root or same-user procs)
    const out = await run("ss -tlnp 2>/dev/null | tail -n +2");
    if (!out.trim()) return [];

    const seen = new Set<string>();
    const byName = new Map<string, { pid: string; ports: string[] }>();

    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Local address — handles *:PORT, 0.0.0.0:PORT, [::]:PORT, 127.0.0.1:PORT
      const addrMatch = trimmed.match(/(?:(?:\*|0\.0\.0\.0|\[::\]|[\d.]+):)(\d+)/);
      const port = addrMatch?.[1];
      if (!port) continue;

      // Process column: users:(("name",pid=X,fd=Y)) — absent without privileges
      const procMatch = trimmed.match(/users:\(\("([^"]+)",pid=(\d+)/);
      if (!procMatch) continue;
      const [, rawName, pid] = procMatch;

      // Strip kernel thread suffixes like ":kworker"
      const name = rawName.split(":")[0];
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
