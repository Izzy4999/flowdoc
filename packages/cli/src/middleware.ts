import { createReadStream, existsSync, mkdirSync, writeFileSync, cpSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import type { Request, Response, NextFunction } from "express";
import { findConfigFile, loadConfig, resolveConfig } from "@flowdoc/core";
import { extractExpressRoutes, buildSpec } from "@flowdoc/parser";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

export interface FlowDocMiddlewareOptions {
  /** Path to flowdoc.config.ts — defaults to auto-discovery from cwd */
  config?: string;
  /** Route prefix the middleware is mounted at — used only for the HTML shell */
  path?: string;
}

/**
 * Express middleware that serves flowdoc docs at whatever route you mount it on.
 * baseUrl is auto-derived from each incoming request — no manual config needed.
 *
 * Usage:
 *   import { flowdoc } from "flowdoc";
 *   app.use("/docs", flowdoc());
 */
export const flowdoc = (opts: FlowDocMiddlewareOptions = {}) => {
  const cwd = process.cwd();
  let outputDir: string | null = null;
  let ready = false;
  let initError: string | null = null;

  // Bootstrap in background — first request will wait if not done
  const init = (async () => {
    try {
      const configPath = opts.config ?? findConfigFile(cwd);
      if (!configPath) throw new Error("No flowdoc.config.ts found. Run `flowdoc init` first.");

      const rawConfig = await loadConfig(configPath);
      const config = resolveConfig(rawConfig, cwd);
      outputDir = config.output ?? join(cwd, "docs-output");

      const routes = await extractExpressRoutes(config);
      const spec = buildSpec(routes, config);

      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, "flowdoc.json"), JSON.stringify(spec, null, 2));

      // Copy UI assets
      const cliRoot = dirname(dirname(fileURLToPath(import.meta.url)));
      const uiAssetsSource = join(cliRoot, "ui-assets");
      if (existsSync(uiAssetsSource)) {
        const dest = join(outputDir, "assets");
        mkdirSync(dest, { recursive: true });
        cpSync(uiAssetsSource, dest, { recursive: true });
      }

      ready = true;
    } catch (err) {
      initError = err instanceof Error ? err.message : String(err);
    }
  })();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Wait for init on first hit
    await init;

    if (initError || !outputDir) {
      res.status(500).send(`flowdoc init failed: ${initError}`);
      return;
    }

    const urlPath = req.path === "/" || req.path === "" ? "/index.html" : req.path;

    // Serve index.html with baseUrl injected from the live request
    if (urlPath === "/index.html") {
      const brand = "#6366f1";
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      res.setHeader("Content-Type", "text/html");
      res.send(buildHtml({ baseUrl, brand }));
      return;
    }

    const filePath = join(outputDir, urlPath);
    if (!existsSync(filePath)) {
      next();
      return;
    }

    const mime = MIME[extname(filePath)] ?? "application/octet-stream";
    res.setHeader("Content-Type", mime);
    createReadStream(filePath).pipe(res);
  };
};

const buildHtml = ({ baseUrl, brand }: { baseUrl: string; brand: string }): string => `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>API Docs</title>
    <script>
      window.__FLOWDOC_BRAND__ = "${brand}";
      window.__FLOWDOC_BASE_URL__ = "${baseUrl}";
    </script>
    <script type="module" crossorigin src="./assets/ui.js"></script>
    <link rel="stylesheet" href="./assets/index.css" />
  </head>
  <body><div id="root"></div></body>
</html>`;
