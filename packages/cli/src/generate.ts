import { writeFileSync, mkdirSync, cpSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import ora from "ora";
import type { FlowDocConfig, FlowDocSpec } from "@flowdoc/core";
import { findConfigFile, loadConfig, resolveConfig } from "@flowdoc/core";
import {
  extractExpressRoutes,
  extractNestRoutes,
  extractFastifyRoutes,
  extractHonoRoutes,
  extractKoaRoutes,
} from "@flowdoc/parser";
import { buildSpec } from "@flowdoc/parser";

export interface GenerateOptions {
  config?: string;
  output?: string;
  quiet?: boolean;
}

export const generate = async (opts: GenerateOptions = {}): Promise<FlowDocSpec> => {
  const cwd = process.cwd();
  const spinner = opts.quiet ? null : ora();

  // 1. Locate config
  spinner?.start("Loading flowdoc config...");

  const configPath = opts.config
    ? resolve(cwd, opts.config)
    : findConfigFile(cwd);

  if (!configPath) {
    spinner?.fail(chalk.red("No flowdoc.config.ts found. Run `flowdoc init` first."));
    process.exit(1);
  }

  let rawConfig: FlowDocConfig;
  try {
    rawConfig = await loadConfig(configPath);
  } catch (err) {
    spinner?.fail(chalk.red(`Failed to load config: ${String(err)}`));
    process.exit(1);
  }

  const config = resolveConfig(rawConfig, cwd);
  spinner?.succeed(`Config loaded — ${chalk.cyan(config.name)}`);

  // 2. Parse routes
  const baseScanLabel = `Scanning ${chalk.cyan(config.entry)} for routes...`;
  spinner?.start(baseScanLabel);

  // ts-morph parsing has no internal progress hooks, so on large repos this step
  // can run for a while with no other feedback — tick elapsed time so the spinner
  // visibly keeps moving instead of looking frozen.
  const scanStartedAt = Date.now();
  const scanTicker = spinner
    ? setInterval(() => {
        const elapsedSec = Math.round((Date.now() - scanStartedAt) / 1000);
        spinner.text = `${baseScanLabel} ${chalk.dim(`(${elapsedSec}s elapsed)`)}`;
      }, 1000)
    : null;

  let routes;
  try {
    routes =
      config.framework === "nestjs"
        ? await extractNestRoutes(config)
        : config.framework === "fastify"
        ? await extractFastifyRoutes(config)
        : config.framework === "hono"
        ? await extractHonoRoutes(config)
        : config.framework === "koa"
        ? await extractKoaRoutes(config)
        : await extractExpressRoutes(config);
  } catch (err) {
    spinner?.fail(chalk.red(`Parse failed: ${String(err)}`));
    process.exit(1);
  } finally {
    if (scanTicker) clearInterval(scanTicker);
  }

  spinner?.succeed(
    `Found ${chalk.green(String(routes.length))} routes across ${chalk.cyan(config.framework)} app`
  );

  // 3. Build spec
  spinner?.start("Building API spec...");
  const spec = buildSpec(routes, config);
  spinner?.succeed(`Built spec — ${chalk.green(String(spec.groups.length))} groups`);

  // 4. Write output
  spinner?.start("Writing docs output...");
  const outputDir = opts.output ? resolve(cwd, opts.output) : (config.output ?? resolve(cwd, "docs-output"));
  mkdirSync(outputDir, { recursive: true });

  const specPath = join(outputDir, "flowdoc.json");
  writeFileSync(specPath, JSON.stringify(spec, null, 2), "utf-8");

  // 5. Copy UI assets into output dir
  await writeUiHtml(outputDir, config);
  spinner?.succeed(`Docs written to ${chalk.cyan(outputDir)}`);

  if (!opts.quiet) {
    console.log();
    console.log(chalk.bold("  flowdoc generated successfully"));
    console.log();
    console.log(`  ${chalk.gray("Spec:")}   ${chalk.cyan(specPath)}`);
    console.log(`  ${chalk.gray("UI:")}     ${chalk.cyan(join(outputDir, "index.html"))}`);
    console.log();
    console.log(`  ${chalk.gray("Routes:")} ${chalk.green(String(routes.length))}`);
    console.log(`  ${chalk.gray("Groups:")} ${chalk.green(String(spec.groups.length))}`);
    console.log();
  }

  return spec;
};

const writeUiHtml = async (outputDir: string, config: FlowDocConfig): Promise<void> => {
  const brand = config.theme?.brand ?? "#6366f1";
  const title = config.name;
  const darkMode = config.theme?.darkMode !== false;

  // Copy bundled UI assets (ui-assets/ lives next to the CLI package root)
  const cliRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const uiAssetsSource = join(cliRoot, "ui-assets");
  const uiAssetsDest = join(outputDir, "assets");

  if (existsSync(uiAssetsSource)) {
    mkdirSync(uiAssetsDest, { recursive: true });
    cpSync(uiAssetsSource, uiAssetsDest, { recursive: true });
  }

  const html = generateHtmlShell({ title, brand, darkMode });
  writeFileSync(join(outputDir, "index.html"), html, "utf-8");
};

interface HtmlShellOptions {
  title: string;
  brand: string;
  darkMode: boolean;
}

const generateHtmlShell = ({ title, brand, darkMode }: HtmlShellOptions): string => `<!DOCTYPE html>
<html lang="en" class="${darkMode ? "dark" : ""}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} — API Docs</title>
    <meta name="description" content="API documentation generated by flowdoc" />
    <script>
      window.__FLOWDOC_BRAND__ = "${brand}";
      window.__FLOWDOC_DARK__ = ${String(darkMode)};
    </script>
    <script type="module" crossorigin src="./assets/ui.js"></script>
    <link rel="stylesheet" href="./assets/index.css" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
