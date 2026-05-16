import type { Service, RemoteOS } from "../core/types.js";

type Runner = (cmd: string) => Promise<string>;

function ps(expr: string) {
  return `powershell -NoProfile -Command "${expr}"`;
}

export async function restartNativeService(run: Runner, service: Service, os: RemoteOS): Promise<void> {
  if (os === "linux")   await run(`systemctl restart ${service.id.replace("systemd:", "")}`);
  else if (os === "macos")  await run(`launchctl kickstart -k system/${service.name}`);
  else if (os === "windows") await run(ps(`Restart-Service '${service.id.replace("winsvc:", "")}'`));
}

export async function stopNativeService(run: Runner, service: Service, os: RemoteOS): Promise<void> {
  if (os === "linux")   await run(`systemctl stop ${service.id.replace("systemd:", "")}`);
  else if (os === "macos")  await run(`launchctl kill SIGTERM system/${service.name}`);
  else if (os === "windows") await run(ps(`Stop-Service '${service.id.replace("winsvc:", "")}'`));
}

export async function startNativeService(run: Runner, service: Service, os: RemoteOS): Promise<void> {
  if (os === "linux")   await run(`systemctl start ${service.id.replace("systemd:", "")}`);
  else if (os === "macos")  await run(`launchctl bootstrap system /Library/LaunchDaemons/${service.name}.plist`);
  else if (os === "windows") await run(ps(`Start-Service '${service.id.replace("winsvc:", "")}'`));
}

export function nativeLogCommand(service: Service, os: RemoteOS): string | null {
  const name = service.id.replace(/^[^:]+:/, "");
  if (os === "linux")    return `journalctl -u ${name} -f --no-pager -n 200`;
  if (os === "macos")    return null; // no simple streaming equivalent
  if (os === "windows")  return null; // Windows Event Log not easily streamable over SSH
  return null;
}

export function nativeLogSnapshot(service: Service, os: RemoteOS): string | null {
  const name = service.id.replace(/^[^:]+:/, "");
  if (os === "linux")    return `journalctl -u ${name} --no-pager -n 200 --output=short`;
  if (os === "macos")    return `log show --predicate 'subsystem == "${service.name}"' --last 5m --info 2>/dev/null | tail -200`;
  if (os === "windows")  return `powershell -NoProfile -Command "Get-EventLog -LogName System -Source '${name}' -Newest 50 -ErrorAction SilentlyContinue | ForEach-Object { $_.TimeGenerated.ToString() + ' ' + $_.EntryType + ' ' + $_.Message }"`;
  return null;
}
