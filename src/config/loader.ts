import { z } from "zod";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSettings } from "./settings.js";
import type { AppConfig } from "../core/types.js";

const DiscoverySchema = z.object({
  docker: z.boolean().default(true),
  nativeServices: z.boolean().default(false),
  includeStoppedContainers: z.boolean().default(true),
});

const HostSchema = z
  .object({
    name: z.string().min(1),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(22),
    username: z.string().min(1),
    authMethod: z.enum(["key", "password"]).default("key"),
    privateKeyPath: z.string().optional(),
    group: z.string().optional(),
    refreshInterval: z.number().int().min(1000).max(60_000).optional(),
    discovery: DiscoverySchema.default({}),
  })
  .refine(
    (h) => h.authMethod === "password" || !!h.privateKeyPath,
    { message: "privateKeyPath required when authMethod is 'key'", path: ["privateKeyPath"] }
  );

const AppConfigSchema = z.object({
  hosts: z.array(HostSchema).default([]),
});

export function resolveConfigPath(explicit?: string): string {
  if (explicit) return explicit;
  const { configPath } = loadSettings();
  if (configPath) return configPath;
  return join(process.cwd(), "homelab.config.json");
}

export function loadConfig(configPath = resolveConfigPath()): AppConfig | null {
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
  return result.data as AppConfig;
}

export function saveConfig(config: AppConfig, configPath = resolveConfigPath()): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
