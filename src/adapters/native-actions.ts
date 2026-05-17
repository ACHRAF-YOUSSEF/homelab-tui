import type { Service, RemoteOS } from "../core/types.js";

type Runner = (cmd: string) => Promise<string>;

function pid(service: Service): string {
  // ID format: proc:<pid>
  return service.id.replace(/^proc:/, "");
}

export async function restartNativeService(_run: Runner, _service: Service, _os: RemoteOS): Promise<void> {
  throw new Error("Cannot restart a discovered process — use Docker or a service manager");
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

export function nativeLogCommand(_service: Service, _os: RemoteOS): string | null {
  // Process discovery doesn't have a reliable log source
  return null;
}

export function nativeLogSnapshot(_service: Service, _os: RemoteOS): string | null {
  return null;
}
