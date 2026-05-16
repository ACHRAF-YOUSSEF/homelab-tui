import type { RemoteOS } from "./types.js";

export async function detectRemoteOS(
  run: (cmd: string) => Promise<string>
): Promise<RemoteOS> {
  // Linux / macOS
  try {
    const out = await run("uname -s");
    if (out.includes("Linux")) return "linux";
    if (out.includes("Darwin")) return "macos";
  } catch {}

  // Windows — $env:OS is "Windows_NT" on all Windows PowerShell versions
  try {
    const out = await run('powershell -NoProfile -Command "$env:OS"');
    if (out.toLowerCase().includes("windows")) return "windows";
  } catch {}

  // Fallback: cmd.exe ver (works even without PowerShell)
  try {
    const out = await run("cmd /c ver");
    if (out.toLowerCase().includes("windows")) return "windows";
  } catch {}

  // Last resort: PSVersionTable.OS (PowerShell 6+)
  try {
    const out = await run('powershell -NoProfile -Command "$PSVersionTable.OS"');
    if (out.toLowerCase().includes("windows")) return "windows";
  } catch {}

  return "unknown";
}
