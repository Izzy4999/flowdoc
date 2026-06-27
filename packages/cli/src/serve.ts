import { createServer } from "http";
import { createReadStream, existsSync } from "fs";
import { join, extname, resolve } from "path";
import chalk from "chalk";
import open from "open";
import chokidar from "chokidar";
import { generate } from "./generate.js";
import type { GenerateOptions } from "./generate.js";
import { findConfigFile, loadConfig, resolveConfig } from "@flowdoc/core";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export interface ServeOptions extends GenerateOptions {
  port?: number;
  noOpen?: boolean;
  watch?: boolean;
}

export const serve = async (opts: ServeOptions = {}): Promise<void> => {
  const cwd = process.cwd();
  const outputDir = opts.output ?? join(cwd, "docs-output");
  const port = opts.port ?? 4000;

  await generate({ ...opts, quiet: false });

  const server = createServer((req, res) => {
    const url = req.url === "/" || req.url === "" ? "/index.html" : (req.url ?? "/index.html");
    const filePath = join(outputDir, url);

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    createReadStream(filePath).pipe(res);
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log();
    console.log(`  ${chalk.bold("flowdoc")} is running at ${chalk.cyan(url)}`);
    if (opts.watch) {
      console.log(`  ${chalk.dim("watching for changes…")}`);
    }
    console.log();

    if (!opts.noOpen) {
      void open(url);
    }
  });

  if (!opts.watch) return;

  // Resolve entry glob to determine what to watch
  const configPath = opts.config ?? findConfigFile(cwd) ?? "";
  let watchGlob = "src/**/*.ts";
  if (configPath) {
    try {
      const raw = await loadConfig(configPath);
      const config = resolveConfig(raw, cwd);
      // Watch the directory that contains the entry file
      const entryDir = resolve(cwd, config.entry).replace(/\/[^/]+$/, "");
      watchGlob = `${entryDir}/**/*.ts`;
    } catch {
      // fall through to default
    }
  }

  let rebuilding = false;
  const watcher = chokidar.watch(watchGlob, {
    ignoreInitial: true,
    ignored: ["**/node_modules/**", "**/dist/**", "**/docs-output/**"],
  });

  const rebuild = async (filePath: string): Promise<void> => {
    if (rebuilding) return;
    rebuilding = true;
    console.log(`  ${chalk.dim("→")} ${chalk.yellow(filePath.replace(cwd + "/", ""))} changed — regenerating…`);
    try {
      await generate({ ...opts, quiet: true });
      console.log(`  ${chalk.green("✓")} docs updated`);
    } catch (err) {
      console.error(`  ${chalk.red("✗")} regeneration failed:`, err instanceof Error ? err.message : err);
    } finally {
      rebuilding = false;
    }
  };

  watcher.on("add", rebuild).on("change", rebuild).on("unlink", rebuild);

  // Keep process alive
  process.on("SIGINT", () => {
    void watcher.close();
    server.close();
    process.exit(0);
  });
};
