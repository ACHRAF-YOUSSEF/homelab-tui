import React from "react";
import { render } from "ink";
import { loadConfig, resolveConfigPath } from "./config/loader.js";
import { loadSettings, saveSettings } from "./config/settings.js";
import { selfUpdate, getLatestRelease, isNewerVersion } from "./updater.js";
import { Root } from "./ui/Root.js";
import { version as VERSION } from "../package.json";
const HELP = `
homelab-tui v${VERSION} — Terminal UI for homelab monitoring

Usage:
  homelab-tui [options]

Options:
  --config <path>     Use a specific config file (session only)
  --set-config <path> Persist a config file path as the default
  --update            Download and install the latest release
  --check-update      Check if an update is available without installing
  --version, -v       Print version and exit
  --help,    -h       Print this help and exit
`.trim();

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  let flagConfig: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    }

    if (arg === "--version" || arg === "-v") {
      console.log(`homelab-tui v${VERSION}`);
      process.exit(0);
    }

    if (arg === "--set-config") {
      const path = argv[++i];
      if (!path) { console.error("--set-config requires a path argument"); process.exit(1); }
      const settings = loadSettings();
      settings.configPath = path;
      saveSettings(settings);
      console.log(`Default config path saved: ${path}`);
      process.exit(0);
    }

    if (arg === "--config" || arg === "-c") {
      flagConfig = argv[++i];
      if (!flagConfig) { console.error("--config requires a path argument"); process.exit(1); }
    }

    if (arg === "--check-update") {
      try {
        const { tag } = await getLatestRelease();
        const newer = isNewerVersion(tag, VERSION);
        console.log(`Latest release: ${tag}  (current: v${VERSION})${newer ? "  ← update available" : "  ✓ up to date"}`);
      } catch (err: unknown) {
        console.error(`Check failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
      process.exit(0);
    }

    if (arg === "--update") {
      try {
        const msg = await selfUpdate();
        console.log(msg);
      } catch (err: unknown) {
        console.error(`Update failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
      process.exit(0);
    }
  }

  // ── Launch TUI ────────────────────────────────────────────────────────────
  const configPath = resolveConfigPath(flagConfig);

  let config;
  let configMissing = false;

  try {
    const loaded = loadConfig(configPath);
    if (loaded === null) {
      config = { hosts: [] };
      configMissing = true;
    } else {
      config = loaded;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Config error: ${msg}\n`);
    process.exit(1);
  }

  render(
    <Root
      initialConfig={config}
      configPath={configPath}
      configMissing={configMissing}
    />
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
