# flowdoc

Auto-generate beautiful API documentation from your Node.js API — no annotations required.

flowdoc scans your TypeScript source, extracts routes, infers schemas from **Zod, Yup, Joi, or class-validator**, and produces an interactive docs UI you can serve or export as a static site.

**Supported frameworks:** Express · NestJS · Fastify · Hono · Koa

## Install

```bash
npm install flowdoc-gen
# or
pnpm add flowdoc-gen
```

## Quick start

```bash
npx flowdoc init        # auto-detects your framework, scaffolds flowdoc.config.ts
npx flowdoc generate    # parse routes → write docs-output/
npx flowdoc serve       # generate + open in browser
npx flowdoc serve -w    # watch mode — re-generates on file changes
```

---

## Express

```ts
// flowdoc.config.ts
export default defineConfig({
  name: "My API",
  framework: "express",
  entry: "./src",
});
```

**Inline middleware** (serves docs at `/docs`, Express only):

```ts
import { flowdoc } from "flowdoc-gen";

app.use("/docs", flowdoc());
// Auto-disabled in production. Override: flowdoc({ disabled: false })
```

flowdoc extracts: `app.get / app.post / router.*`, path params, Zod/Yup/Joi/class-validator body schemas from validation middleware, response shapes from `res.json(...)`.

---

## NestJS

```ts
export default defineConfig({
  name: "My API",
  framework: "nestjs",
  entry: "./src",
});
```

flowdoc extracts: `@Controller` + `@Get/@Post/@Put/@Patch/@Delete` decorators, class-validator DTOs, Zod pipes.

**Inline middleware:** Nest's default HTTP adapter is Express, so mount the Express middleware directly:

```ts
import { flowdoc } from "flowdoc-gen";

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.use("/docs", flowdoc());
```

If your app runs on the Fastify adapter (`NestFastifyApplication`), use `flowdocFastify` instead — see the Fastify section below and register it via `app.register(flowdocFastify, { prefix: "/docs" })`.

```bash
npx flowdoc serve   # static site generation, works regardless of adapter
```

---

## Fastify

```ts
export default defineConfig({
  name: "My API",
  framework: "fastify",
  entry: "./src",
});
```

flowdoc extracts: `fastify.METHOD(path, ...)` calls, `schema.body` / `schema.querystring` route config, Zod schemas.

**Inline middleware** (serves docs at `/docs`):

```ts
import { flowdocFastify } from "flowdoc-gen";

fastify.register(flowdocFastify, { prefix: "/docs" });
// Auto-disabled in production. Override: { prefix: "/docs", disabled: false }
```

```bash
npx flowdoc serve   # static site generation
```

---

## Hono

```ts
export default defineConfig({
  name: "My API",
  framework: "hono",
  entry: "./src",
});
```

flowdoc extracts: `app.METHOD(path, handler)` calls, `zValidator` middleware schemas, path params.

**Inline middleware** (serves docs at `/docs`):

```ts
import { flowdocHono } from "flowdoc-gen";

// Hono doesn't strip mount prefixes automatically — pass `path` to match the route
app.get("/docs/*", flowdocHono({ path: "/docs" }));
```

```bash
npx flowdoc serve   # static site generation
```

---

## Koa

```ts
export default defineConfig({
  name: "My API",
  framework: "koa",
  entry: "./src",
});
```

flowdoc extracts: `router.METHOD(path, ...)` calls via `@koa/router`, Zod/Joi body validation middleware.

**Inline middleware** (serves docs at `/docs`):

```ts
import mount from "koa-mount";
import { flowdocKoa } from "flowdoc-gen";

app.use(mount("/docs", flowdocKoa()));
// Auto-disabled in production. Override: flowdocKoa({ disabled: false })
```

```bash
npx flowdoc serve   # static site generation
```

---

## Config reference

```ts
import { defineConfig } from "flowdoc-gen";

export default defineConfig({
  name: "My API",
  version: "1.0.0",
  description: "...",
  framework: "express",   // express | nestjs | fastify | hono | koa
  entry: "./src",
  output: "./docs-output",

  // Exclude routes from docs (glob patterns)
  exclude: ["/health", "/internal/**", "/metrics"],

  // Group routes into named sections
  groups: {
    "Auth":  ["/auth/**"],
    "Users": ["/users/**"],
  },

  auth: { type: "bearer" }, // bearer | apiKey | basic | oauth2

  theme: {
    brand: "#6366f1",
    darkMode: true,
  },
});
```

## CLI reference

| Command | Description |
|---------|-------------|
| `flowdoc init` | Scaffold `flowdoc.config.ts` (auto-detects framework) |
| `flowdoc generate` | Parse routes and write `docs-output/` |
| `flowdoc serve` | Generate and open docs in browser |
| `flowdoc serve --watch` | Re-generates on source changes |
| `flowdoc serve --port 5000` | Custom port (default 4000) |

## Schema support

| Library | Auto-detected from |
|---|---|
| **Zod** | `z.object(...)` passed to middleware or `.parse()` |
| **Yup** | `yup.object(...)` definitions |
| **Joi** | `Joi.object(...)` definitions |
| **class-validator** | Decorated DTO classes |

## License

MIT
