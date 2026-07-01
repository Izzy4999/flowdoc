import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { findConfigFile, loadConfig, resolveConfig } from "@flowdoc/core";
import {
  extractExpressRoutes,
  extractNestRoutes,
  extractFastifyRoutes,
  extractHonoRoutes,
  extractKoaRoutes,
  buildSpec,
} from "@flowdoc/parser";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

export interface FlowDocServeOptions {
  /** Path to flowdoc.config.ts — defaults to auto-discovery from cwd */
  config?: string;
  /** Route prefix the middleware is mounted at — used only for the HTML shell */
  path?: string;
  /**
   * Disable the docs endpoint. Useful for production environments.
   * Defaults to `process.env.NODE_ENV === "production"` when not set,
   * meaning docs are served in development and blocked in production.
   * Pass `false` to explicitly enable in production; `true` to always block.
   */
  disabled?: boolean;
}

interface ReadyState {
  ok: true;
}

interface ErrorState {
  ok: false;
  error: string;
}

interface ResolvedAsset {
  content: Buffer;
  mime: string;
}

export interface DocsServerCore {
  disabled: boolean;
  ready: () => Promise<ReadyState | ErrorState>;
  resolveAsset: (urlPath: string) => ResolvedAsset | null;
  renderHtml: (params: { baseUrl: string; docsBase: string }) => string;
}

/**
 * Framework-agnostic bootstrap for serving flowdoc docs from a running server.
 * Handles config resolution, route extraction (dispatched by config.framework,
 * matching the static `generate()` pipeline), spec + UI asset writing, and
 * on-demand asset lookup. Per-framework adapters (Express, Fastify, Koa, Hono)
 * wrap this with their own request/response plumbing.
 */
export const createDocsServerCore = (opts: FlowDocServeOptions = {}): DocsServerCore => {
  const disabled = opts.disabled ?? process.env.NODE_ENV === "production";
  const cwd = process.cwd();
  let outputDir: string | null = null;
  let brand = "#6366f1";
  let initError: string | null = null;

  // Bootstrap in background — first request waits on this if not done yet
  const init = (async () => {
    try {
      const configPath = opts.config ?? findConfigFile(cwd);
      if (!configPath) throw new Error("No flowdoc.config.ts found. Run `flowdoc init` first.");

      const rawConfig = await loadConfig(configPath);
      const config = resolveConfig(rawConfig, cwd);
      brand = config.theme?.brand ?? "#6366f1";
      outputDir = config.output ?? join(cwd, "docs-output");

      const routes =
        config.framework === "nestjs"
          ? await extractNestRoutes(config)
          : config.framework === "fastify"
          ? await extractFastifyRoutes(config)
          : config.framework === "hono"
          ? await extractHonoRoutes(config)
          : config.framework === "koa"
          ? await extractKoaRoutes(config)
          : await extractExpressRoutes(config);

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
    } catch (err) {
      initError = err instanceof Error ? err.message : String(err);
    }
  })();

  return {
    disabled,
    ready: async () => {
      await init;
      if (initError || !outputDir) {
        return { ok: false, error: initError ?? "flowdoc failed to initialize" };
      }
      return { ok: true };
    },
    resolveAsset: (urlPath) => {
      if (!outputDir) return null;
      const filePath = join(outputDir, urlPath);
      if (!existsSync(filePath)) return null;
      const mime = MIME[extname(filePath)] ?? "application/octet-stream";
      return { content: readFileSync(filePath), mime };
    },
    renderHtml: ({ baseUrl, docsBase }) => buildHtml({ baseUrl, brand, docsBase }),
  };
};

const buildHtml = ({ baseUrl, brand, docsBase }: { baseUrl: string; brand: string; docsBase: string }): string => `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>API Docs</title>
    <script>
      window.__FLOWDOC_BRAND__ = "${brand}";
      window.__FLOWDOC_BASE_URL__ = "${baseUrl}";
      window.__FLOWDOC_DOCS_BASE__ = "${docsBase}";
    </script>
    <script type="module" crossorigin src="${docsBase}/assets/ui.js"></script>
    <link rel="stylesheet" href="${docsBase}/assets/index.css" />
  </head>
  <body><div id="root"></div></body>
</html>`;
