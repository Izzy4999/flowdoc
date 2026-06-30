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

## Framework guides

### Express

flowdoc extracts `app.get`, `app.post`, `router.get`, etc. and infers schemas from validation middleware.

```ts
// flowdoc.config.ts
export default defineConfig({
  name: "My API",
  framework: "express",
  entry: "./src",
});
```

**What gets extracted automatically:**
- All HTTP method calls (`app.get`, `app.post`, `router.put`, …)
- Path parameters (`:id` → `id: string`)
- Request body schemas from validation middleware: `validate(schema)`, `validateBody(schema)`, `celebrate({ body: schema })`, etc.
- Query parameter schemas from `validateQuery(schema)`, `queryValidator(schema)`
- Response schemas inferred from `res.json({ ... })` inline objects, `res.json(SomeSchema.parse(data))`, or variable naming conventions (`userResponseSchema`, `userResSchema`)

**Inline middleware docs server (Express only):**

```ts
import express from "express";
import { flowdoc } from "flowdoc-gen";

const app = express();

// Docs served at /docs — auto-disabled in production, baseUrl auto-detected
app.use("/docs", flowdoc());

app.listen(3000);
```

The middleware auto-disables when `NODE_ENV=production`. To force-enable or force-disable:

```ts
app.use("/docs", flowdoc({ disabled: false })); // always on
app.use("/docs", flowdoc({ disabled: true }));  // always off
```

---

### NestJS

flowdoc reads your `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` decorators and infers schemas from DTO classes (class-validator) and Zod pipes.

```ts
// flowdoc.config.ts
export default defineConfig({
  name: "My API",
  framework: "nestjs",
  entry: "./src",
});
```

**What gets extracted automatically:**
- Controller route prefixes + method decorators (`@Get(':id')`, `@Post()`, …)
- Path parameters from route strings
- Request body schemas from class-validator DTOs (`@IsEmail()`, `@IsString()`, etc.)
- Zod schemas passed to `ZodValidationPipe`

**Example controller that flowdoc understands:**

```ts
@Controller("users")
export class UsersController {
  @Get()
  findAll() { ... }

  @Get(":id")
  findOne(@Param("id") id: string) { ... }

  @Post()
  create(@Body() dto: CreateUserDto) { ... }
}
```

> NestJS docs are static-site only — use `flowdoc generate` or `flowdoc serve`. The inline Express middleware does not apply.

---

### Fastify

flowdoc extracts `fastify.get`, `fastify.post`, `fastify.route`, and route objects registered via plugins.

```ts
// flowdoc.config.ts
export default defineConfig({
  name: "My API",
  framework: "fastify",
  entry: "./src",
});
```

**What gets extracted automatically:**
- All `fastify.METHOD(path, ...)` calls
- Route path parameters (`:id`, `*`)
- Zod schemas passed to route handler options
- Schema objects in route config (`schema.body`, `schema.querystring`)

**Example routes that flowdoc understands:**

```ts
fastify.get("/users/:id", async (request, reply) => {
  return reply.send({ id: request.params.id });
});

fastify.post("/users", {
  schema: { body: CreateUserSchema },
  handler: async (request, reply) => { ... },
});
```

> Fastify docs are static-site only — use `flowdoc generate` or `flowdoc serve`.

---

### Hono

flowdoc extracts routes registered via `app.get`, `app.post`, and chained `.route()` calls.

```ts
// flowdoc.config.ts
export default defineConfig({
  name: "My API",
  framework: "hono",
  entry: "./src",
});
```

**What gets extracted automatically:**
- All `app.METHOD(path, handler)` calls
- Path parameters (`:id`)
- Zod schemas used with `zValidator` middleware

**Example routes that flowdoc understands:**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

const app = new Hono();

app.get("/users/:id", (c) => c.json({ id: c.req.param("id") }));

app.post("/users", zValidator("json", CreateUserSchema), async (c) => {
  const body = c.req.valid("json");
  return c.json({ ...body }, 201);
});
```

> Hono docs are static-site only — use `flowdoc generate` or `flowdoc serve`.

---

### Koa

flowdoc extracts routes registered via `koa-router` (`router.get`, `router.post`, etc.).

```ts
// flowdoc.config.ts
export default defineConfig({
  name: "My API",
  framework: "koa",
  entry: "./src",
});
```

**What gets extracted automatically:**
- All `router.METHOD(path, ...)` calls
- Path parameters (`:id`)
- Zod/Joi schemas passed to body validation middleware

**Example routes that flowdoc understands:**

```ts
import Router from "@koa/router";

const router = new Router();

router.get("/users/:id", async (ctx) => {
  ctx.body = { id: ctx.params.id };
});

router.post("/users", validateBody(CreateUserSchema), async (ctx) => {
  ctx.status = 201;
  ctx.body = ctx.request.body;
});
```

> Koa docs are static-site only — use `flowdoc generate` or `flowdoc serve`.

---

## Schema support

flowdoc auto-detects and infers schemas from any of these — no configuration needed:

| Library | Detected from |
|---|---|
| **Zod** | `z.object(...)` assigned to any variable, passed to middleware or `.parse()` |
| **Yup** | `yup.object(...)` schema definitions |
| **Joi** | `Joi.object(...)` schema definitions |
| **class-validator** | Decorated DTO classes (`@IsEmail()`, `@IsString()`, etc.) |

---

## Config reference

```ts
// flowdoc.config.ts
import { defineConfig } from "flowdoc-gen";

export default defineConfig({
  name: "My API",
  version: "1.0.0",
  description: "Optional description shown in the docs header",
  framework: "express",       // express | nestjs | fastify | hono | koa
  entry: "./src",             // directory or file to scan
  output: "./docs-output",    // where to write the static site

  // Exclude specific routes from the docs
  exclude: [
    "/health",
    "/internal/**",
    "/metrics",
  ],

  // Group routes into named sections (glob patterns)
  groups: {
    "Auth":   ["/auth/**"],
    "Users":  ["/users/**"],
    "Orders": ["/orders/**"],
  },

  // Auth scheme shown in the playground
  auth: {
    type: "bearer",           // bearer | apiKey | basic | oauth2
  },

  theme: {
    brand: "#6366f1",         // accent color
    darkMode: true,
  },
});
```

---

## CLI reference

| Command | Description |
|---|---|
| `flowdoc init` | Scaffold `flowdoc.config.ts` (auto-detects framework) |
| `flowdoc generate` | Parse routes → write `docs-output/` |
| `flowdoc serve` | Generate + open docs in browser |
| `flowdoc serve --watch` | Watch mode — re-generates on source changes |
| `flowdoc serve --port 5000` | Custom port (default 4000) |

---

## Monorepo structure

```
packages/
  cli/     → flowdoc-gen (published to npm)
  core/    → shared types and schema utilities
  parser/  → AST route + schema extractor
  ui/      → React docs viewer (Vite + Tailwind)
examples/
  express-app/  → working demo
```

## License

MIT — [Favour Israel Taiwo](https://fiittech.fun)
