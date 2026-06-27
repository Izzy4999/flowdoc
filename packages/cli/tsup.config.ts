import { defineConfig } from "tsup";

export default defineConfig([
  // CLI binary — bundle workspace deps so the published package is self-contained
  {
    entry: { bin: "src/bin.ts" },
    format: ["esm"],
    target: "node18",
    bundle: true,
    noExternal: ["@flowdoc/core", "@flowdoc/parser"],
    external: [
      // Keep heavy native-ish deps external so npm installs them
      "ts-morph",
      "typescript",
      "chokidar",
      "chalk",
      "commander",
      "ora",
      "open",
      "glob",
      "zod-to-json-schema",
    ],
    clean: false,
    dts: false,
  },
  // Public API (the `flowdoc` import users put in their server)
  // Build both ESM and CJS so it works in any project type
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    target: "node18",
    bundle: true,
    shims: true,
    noExternal: ["@flowdoc/core", "@flowdoc/parser"],
    external: [
      "ts-morph",
      "typescript",
      "chokidar",
      "chalk",
      "commander",
      "ora",
      "open",
      "glob",
      "zod-to-json-schema",
      "express",
    ],
    clean: false,
    dts: { resolve: ["@flowdoc/core", "@flowdoc/parser"] },
  },
]);
