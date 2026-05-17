import { chmodSync, existsSync, renameSync, writeFileSync } from "node:fs";

const REPO = "ACHRAF-YOUSSEF/homelab-tui";
const BAR_WIDTH = 40;

export function isNewerVersion(remoteTag: string, currentVersion: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [rMaj = 0, rMin = 0, rPat = 0] = parse(remoteTag);
  const [cMaj = 0, cMin = 0, cPat = 0] = parse(currentVersion);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

type Release = {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
};

function assetName(): string {
  const p =
    process.platform === "win32" ? "windows" :
    process.platform === "darwin" ? "darwin" : "linux";
  const a = process.arch === "arm64" ? "arm64" : "x64";
  const ext = process.platform === "win32" ? ".exe" : "";
  return `homelab-tui-${p}-${a}${ext}`;
}

export async function getLatestRelease(): Promise<{ tag: string; downloadUrl: string; name: string }> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "homelab-tui" },
  });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

  const release = await res.json() as Release;
  const name = assetName();
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) throw new Error(`No binary for ${name} in release ${release.tag_name}`);

  return { tag: release.tag_name, downloadUrl: asset.browser_download_url, name };
}

async function downloadWithProgress(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const total = Number.parseInt(res.headers.get("content-length") ?? "0", 10);

  if (!res.body) {
    // No streaming — fallback
    return Buffer.from(await res.arrayBuffer());
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;

    if (total > 0) {
      const pct = Math.min(100, Math.floor((received / total) * 100));
      const filled = Math.floor((pct / 100) * BAR_WIDTH);
      const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
      const mb = (received / 1_048_576).toFixed(1);
      const totalMb = (total / 1_048_576).toFixed(1);
      process.stdout.write(`\r  [${bar}] ${pct}%  ${mb} / ${totalMb} MB`);
    } else {
      const mb = (received / 1_048_576).toFixed(1);
      process.stdout.write(`\r  ${mb} MB downloaded…`);
    }
  }

  process.stdout.write("\n");
  return Buffer.concat(chunks);
}

export async function selfUpdate(): Promise<string> {
  process.stdout.write("Checking for updates…\n");
  const { tag, downloadUrl, name } = await getLatestRelease();

  process.stdout.write(`Downloading ${name} (${tag})…\n`);
  const buf = await downloadWithProgress(downloadUrl);

  const current = process.execPath;

  if (process.platform === "win32") {
    const next = current.replace(/\.exe$/, "") + "-update.exe";
    writeFileSync(next, buf);
    return `Downloaded to ${next}\nManually replace ${current} with ${next} after closing the app.`;
  }

  const tmp = current + ".new";
  const backup = current + ".old";
  writeFileSync(tmp, buf);
  chmodSync(tmp, 0o755);

  try {
    if (existsSync(backup)) renameSync(backup, backup + ".bak");
    renameSync(current, backup);
    renameSync(tmp, current);
  } catch (err) {
    if (existsSync(backup)) {
      try { renameSync(backup, current); } catch {}
    }
    throw err;
  }

  return `Updated to ${tag}. Restart homelab-tui.`;
}
