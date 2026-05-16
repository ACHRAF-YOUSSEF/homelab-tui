import { z } from "zod";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "../core/types.js";

const DiscoverySchema = z.object({
  docker: z.boolean().default(true),
  nativeServices: z.boolean().default(false),
  includeStoppedContainers: z.boolean().default(true),
});

const HostSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1),
  privateKeyPath: z.string().min(1),
  discovery: DiscoverySchema.default({}),
});

const AppConfigSchema = z.object({
  hosts: z.array(HostSchema).default([]),
});

export const CONFIG_PATH = join(process.cwd(), "homelab.config.json");

export function loadConfig(configPath = CONFIG_PATH): AppConfig | null {
  if (!existsSync(configPath)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot parse config at ${configPath}: ${msg}`);
  }

  const result = AppConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${issues}`);
  }
  return result.data;
}

export function saveConfig(config: AppConfig, configPath = CONFIG_PATH): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
