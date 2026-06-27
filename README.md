# flowdoc

Auto-generate beautiful API documentation from your Express codebase — no annotations required.

flowdoc scans your TypeScript source, extracts Express routes, infers schemas from **Zod, Yup, Joi, or class-validator**, and produces an interactive docs UI you can serve directly from your own server.

## Install

```bash
npm install flowdoc-gen
```

## Quick start

### Option A — Serve docs from your Express server

```ts
import { flowdoc } from "flowdoc";

app.use("/docs", flowdoc());
// Docs live at http://localhost:3000/docs — baseUrl auto-detected per request
```

### Option B — Generate a static site

```bash
npx flowdoc init        # scaffold flowdoc.config.ts
npx flowdoc generate    # write docs-output/
npx flowdoc serve       # generate + open in browser
npx flowdoc serve -w    # re-generate on file changes (watch mode)
```

## Schema support

flowdoc auto-detects and infers schemas from any of these — no configuration needed:

| Library | Example |
|---|---|
| **Zod** | `z.object({ email: z.string().email() })` |
| **Yup** | `yup.object({ email: yup.string().email().required() })` |
| **Joi** | `Joi.object({ email: Joi.string().email().required() })` |
| **class-validator** | `@IsEmail() email: string` |

## CLI

| Command | Description |
|---|---|
| `flowdoc init` | Scaffold `flowdoc.config.ts` |
| `flowdoc generate` | Parse routes → write `docs-output/` |
| `flowdoc serve` | Generate + open in browser |
| `flowdoc serve --watch` | Watch mode — re-generates on change |
| `flowdoc serve --port 5000` | Custom port (default 4000) |

## Config

```ts
// flowdoc.config.ts
import { defineConfig } from "flowdoc";

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

## Monorepo structure

```
packages/
  cli/     → flowdoc (published to npm)
  core/    → shared types and schema utilities
  parser/  → AST route + schema extractor
  ui/      → React docs viewer (Vite + Tailwind)
examples/
  express-app/  → working demo
```

## License

MIT — [Favour Israel Taiwo](https://fiittech.fun)
