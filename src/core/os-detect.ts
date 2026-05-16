import type { RemoteOS } from "./types.js";

export async function detectRemoteOS(
  run: (cmd: string) => Promise<string>
): Promise<RemoteOS> {
  try {
    const out = await run("uname -s");
    if (out.includes("Linux")) return "linux";
    if (out.includes("Darwin")) return "macos";
  } catch {
    // uname not available — try PowerShell
  }

  try {
    const out = await run(
      'powershell -NoProfile -Command "$PSVersionTable.OS"'
    );
    if (out.toLowerCase().includes("windows")) return "windows";
  } catch {
    // PowerShell not available either
  }

  return "unknown";
}
