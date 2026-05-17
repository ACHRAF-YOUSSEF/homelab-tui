import type { Service, RemoteOS } from "../core/types.js";

type Runner = (cmd: string) => Promise<string>;

function pid(service: Service): string {
  return service.id.replace(/^proc:/, "");
}

export async function restartNativeService(run: Runner, service: Service, os: RemoteOS): Promise<void> {
  if (os !== "linux") {
    throw new Error("Restart only supported for systemd-managed processes on Linux");
  }
  const p = pid(service);
  if (!p) throw new Error("Unknown PID");

  // Find the systemd unit managing this PID
  let unit = "";
  try {
    const out = await run(`systemctl status ${p} 2>/dev/null | head -1 | awk '{print $2}'`);
    const trimmed = out.trim();
    if (trimmed.match(/\.(service|socket|timer)$/)) unit = trimmed;
  } catch {}

  if (!unit) {
    throw new Error(`${service.name} is not managed by systemd — cannot restart`);
  }

  await run(`systemctl restart ${unit}`);
}

export async function stopNativeService(run: Runner, service: Service, os: RemoteOS): Promise<void> {
  const p = pid(service);
  if (!p) throw new Error("Unknown PID");
  if (os === "windows") {
    await run(`powershell -NoProfile -Command "Stop-Process -Id ${p} -Force -ErrorAction Stop"`);
  } else {
    await run(`kill ${p}`);
  }
}

export async function startNativeService(_run: Runner, _service: Service, _os: RemoteOS): Promise<void> {
  throw new Error("Cannot start a discovered process — use Docker or a service manager");
}

export function nativeLogCommand(service: Service, os: RemoteOS): string | null {
  const p = pid(service);
  if (!p) return null;
  if (os === "linux") return `journalctl -f -n 50 _PID=${p} 2>/dev/null`;
  if (os === "macos") return `log stream --process ${p} --style syslog 2>/dev/null`;
  return null;
}

export function nativeLogSnapshot(service: Service, os: RemoteOS): string | null {
  const p = pid(service);
  if (!p) return null;
  if (os === "linux") return `journalctl -n 100 --no-pager _PID=${p} 2>/dev/null`;
  return null;
}
