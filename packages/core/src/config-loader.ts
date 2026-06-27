import { existsSync } from "fs";
import { resolve, join } from "path";
import type { FlowDocConfig } from "./types.js";

const CONFIG_FILES = [
  "flowdoc.config.ts",
  "flowdoc.config.js",
  "flowdoc.config.mjs",
];

export const findConfigFile = (cwd: string): string | null => {
  for (const file of CONFIG_FILES) {
    const full = join(cwd, file);
    if (existsSync(full)) return full;
  }
  return null;
};

export const loadConfig = async (configPath: string): Promise<FlowDocConfig> => {
  const resolved = resolve(configPath);
  const mod = await import(resolved) as { default?: FlowDocConfig } | FlowDocConfig;
  const config = "default" in mod ? mod.default : mod;
  if (!config) throw new Error(`No config exported from ${configPath}`);
  return config as FlowDocConfig;
};

export const resolveConfig = (config: FlowDocConfig, cwd: string): FlowDocConfig => ({
  version: "1.0.0",
  baseUrl: "http://localhost:3000",
  ...config,
  entry: resolve(cwd, config.entry),
  output: resolve(cwd, config.output ?? "./docs-output"),
});
