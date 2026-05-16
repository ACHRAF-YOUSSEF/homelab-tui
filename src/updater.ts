import { chmodSync, existsSync, renameSync, writeFileSync } from "node:fs";

const REPO = "ACHRAF-YOUSSEF/homelab-tui";

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

export async function selfUpdate(): Promise<string> {
  process.stdout.write("Checking for updates…\n");
  const { tag, downloadUrl, name } = await getLatestRelease();

  process.stdout.write(`Downloading ${name} (${tag})…\n`);
  const dl = await fetch(downloadUrl);
  if (!dl.ok) throw new Error(`Download failed: ${dl.status}`);

  const buf = Buffer.from(await dl.arrayBuffer());
  const current = process.execPath;

  if (process.platform === "win32") {
    // Can't replace a running exe on Windows — write next to it and instruct user
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
    // Attempt rollback
    if (existsSync(backup)) {
      try { renameSync(backup, current); } catch {}
    }
    throw err;
  }

  return `Updated to ${tag}. Restart homelab-tui.`;
}
