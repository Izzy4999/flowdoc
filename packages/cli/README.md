# flowdoc

Auto-generate beautiful API documentation from your Express codebase — no annotations required.

flowdoc scans your TypeScript source files, extracts Express routes, infers Zod schemas, and produces an interactive docs UI served directly from your server.

## Install

```bash
npm install flowdoc-gen
# or
pnpm add flowdoc-gen
```

## Quick start

### 1. Scaffold a config

```bash
npx flowdoc init
```

This creates `flowdoc.config.ts` in your project root.

### 2. Serve docs from your own Express server

```ts
import express from "express";
import { flowdoc } from "flowdoc-gen";

const app = express();
app.use("/docs", flowdoc());

app.listen(3000);
// Docs are live at http://localhost:3000/docs
```

The `baseUrl` is auto-detected from every incoming request — no manual config needed.

### 3. Or generate a static site

```bash
npx flowdoc generate        # writes docs-output/
npx flowdoc serve           # generate + open in browser
npx flowdoc serve --watch   # re-generate on file changes
```

## CLI reference

| Command | Description |
|---------|-------------|
| `flowdoc init` | Scaffold `flowdoc.config.ts` |
| `flowdoc generate` | Parse routes and write `docs-output/` |
| `flowdoc serve` | Generate and open docs in browser |
| `flowdoc serve --watch` | Same, but re-generates on source changes |
| `flowdoc serve --port 5000` | Custom port (default 4000) |

## Config

```ts
// flowdoc.config.ts
import { defineConfig } from "flowdoc-gen";

export default defineConfig({
  name: "My API",
  entry: "src/**/*.ts",
  framework: "express",
  output: "docs-output",
  groups: [
    { name: "Auth",  match: "/auth/**" },
    { name: "Users", match: "/users/**" },
  ],
  theme: {
    brand: "#6366f1",
    darkMode: true,
  },
});
```

## What gets inferred automatically

- All Express routes (`app.get`, `app.post`, `router.use`, etc.)
- Path parameters (`/users/:id` → `id: string` in path params)
- Zod request body schemas passed to validation middleware
- Route grouping by path prefix

## License

MIT
