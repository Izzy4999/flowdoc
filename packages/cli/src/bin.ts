#!/usr/bin/env node
import { program } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8")) as { version: string };

program
  .name("flowdoc")
  .description("Auto-generate beautiful API documentation from your Express codebase")
  .version(pkg.version);

program
  .command("init")
  .description("Scaffold a flowdoc.config.ts in the current directory")
  .action(async () => {
    const { init } = await import("./init.js");
    init();
  });

program
  .command("generate")
  .description("Parse your routes and write docs to the output folder")
  .option("-c, --config <path>", "Path to flowdoc config file")
  .option("-o, --output <path>", "Override output directory")
  .option("-q, --quiet", "Suppress output")
  .action(async (opts: { config?: string; output?: string; quiet?: boolean }) => {
    const { generate } = await import("./generate.js");
    await generate(opts);
  });

program
  .command("serve")
  .description("Generate docs and serve them locally")
  .option("-c, --config <path>", "Path to flowdoc config file")
  .option("-o, --output <path>", "Override output directory")
  .option("-p, --port <number>", "Port to serve on (default: 4000)", "4000")
  .option("-w, --watch", "Re-generate docs on source file changes")
  .option("--no-open", "Don't open browser automatically")
  .action(async (opts: { config?: string; output?: string; port?: string; watch?: boolean; open?: boolean }) => {
    const { serve } = await import("./serve.js");
    const serveOpts: import("./serve.js").ServeOptions = {
      port: opts.port ? parseInt(opts.port, 10) : 4000,
      noOpen: !opts.open,
      watch: opts.watch ?? false,
    };
    if (opts.config !== undefined) serveOpts.config = opts.config;
    if (opts.output !== undefined) serveOpts.output = opts.output;
    await serve(serveOpts);
  });

program.parse();
