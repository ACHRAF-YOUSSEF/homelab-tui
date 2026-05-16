import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type AppSettings = {
  configPath?: string;
};

export function getSettingsDir(): string {
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? homedir(), "homelab-tui");
  }
  return join(homedir(), ".config", "homelab-tui");
}

const SETTINGS_FILE = join(getSettingsDir(), "settings.json");

export function loadSettings(): AppSettings {
  if (!existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_FILE, "utf-8")) as AppSettings;
  } catch {
    return {};
  }
}

export function saveSettings(settings: AppSettings): void {
  mkdirSync(getSettingsDir(), { recursive: true });
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}
