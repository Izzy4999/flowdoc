# Graph Report - api-docs  (2026-07-01)

## Corpus Check
- 64 files · ~23,844 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 575 nodes · 855 edges · 45 communities (39 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3751dc71`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_CLI Package Manifest|CLI Package Manifest]]
- [[_COMMUNITY_Schema Parser Module|Schema Parser Module]]
- [[_COMMUNITY_UI Components & Playground|UI Components & Playground]]
- [[_COMMUNITY_Root Workspace Config|Root Workspace Config]]
- [[_COMMUNITY_Parser Package Dependencies|Parser Package Dependencies]]
- [[_COMMUNITY_Bundled UI Assets|Bundled UI Assets]]
- [[_COMMUNITY_CLI Feature Documentation|CLI Feature Documentation]]
- [[_COMMUNITY_CLI Generate & Config Loader|CLI Generate & Config Loader]]
- [[_COMMUNITY_UI Package Config|UI Package Config]]
- [[_COMMUNITY_Core Module Exports|Core Module Exports]]
- [[_COMMUNITY_Zod Schema Extractor|Zod Schema Extractor]]
- [[_COMMUNITY_Core Package Manifest|Core Package Manifest]]
- [[_COMMUNITY_Example Express App|Example Express App]]
- [[_COMMUNITY_Base TypeScript Config|Base TypeScript Config]]
- [[_COMMUNITY_Express App Routes & Middleware|Express App Routes & Middleware]]
- [[_COMMUNITY_Yup Schema Extractor|Yup Schema Extractor]]
- [[_COMMUNITY_CLI Runtime Dependencies|CLI Runtime Dependencies]]
- [[_COMMUNITY_UI TypeScript Config|UI TypeScript Config]]
- [[_COMMUNITY_CLI TypeScript Config|CLI TypeScript Config]]
- [[_COMMUNITY_Core TypeScript Config|Core TypeScript Config]]
- [[_COMMUNITY_Express App TypeScript Config|Express App TypeScript Config]]
- [[_COMMUNITY_Parser TypeScript Config|Parser TypeScript Config]]
- [[_COMMUNITY_CLI Entry Point (bin)|CLI Entry Point (bin)]]
- [[_COMMUNITY_flowdoc Config Example|flowdoc Config Example]]
- [[_COMMUNITY_UI Main Entry|UI Main Entry]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `flowdoc` - 19 edges
2. `flowdoc` - 19 edges
3. `extractJoiSchemas()` - 15 edges
4. `compilerOptions` - 15 edges
5. `generate()` - 14 edges
6. `extractYupSchemas()` - 14 edges
7. `extractZodSchemas()` - 13 edges
8. `extractClassValidatorSchemas()` - 12 edges
9. `zodNodeToJsonSchema()` - 12 edges
10. `extractExpressRoutes()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `flowdoc Express Middleware` --semantically_similar_to--> `Express Route Extraction (app.get, app.post, router.use)`  [INFERRED] [semantically similar]
  README.md → packages/cli/README.md
- `Schema Inference (Zod/Yup/Joi/class-validator)` --semantically_similar_to--> `Zod Schema Inference (CLI)`  [INFERRED] [semantically similar]
  README.md → packages/cli/README.md
- `flowdoc.config.ts Configuration` --conceptually_related_to--> `flowdoc`  [INFERRED]
  README.md → packages/cli/README.md
- `packages/cli — flowdoc CLI (npm published)` --references--> `flowdoc`  [INFERRED]
  README.md → packages/cli/README.md
- `packages/* Workspace Glob` --references--> `packages/core — Shared Types and Schema Utilities`  [INFERRED]
  pnpm-workspace.yaml → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **flowdoc Monorepo Package Structure (cli, core, parser, ui)** — readme_package_cli, readme_package_core, readme_package_parser, readme_package_ui, pnpm_workspace_packages_glob [INFERRED 0.95]
- **Automatic API Doc Inference Pipeline (route extraction, schema inference, path params, grouping)** — cli_readme_express_route_extraction, cli_readme_zod_schema_inference, cli_readme_path_param_inference, cli_readme_route_grouping [EXTRACTED 1.00]
- **flowdoc Config, Theme, and UI Brand Color form a unified theming system** — readme_flowdoc_config, ui_index_flowdoc_brand, readme_defineconfig [INFERRED 0.75]

## Communities (45 total, 6 thin omitted)

### Community 0 - "CLI Package Manifest"
Cohesion: 0.12
Nodes (17): bin, flowdoc, description, engines, node, exports, files, homepage (+9 more)

### Community 1 - "Schema Parser Module"
Cohesion: 0.08
Nodes (55): CONSTRAINED, DECORATOR_MAP, extractClassValidatorSchemas(), OPTIONAL_DECORATORS, extractExpressRoutes(), extractFastifyRoutes(), buildDefaultResponses(), deduplicateRoutes() (+47 more)

### Community 2 - "UI Components & Playground"
Cohesion: 0.09
Nodes (25): METHOD_STYLES, MethodBadge(), MethodBadgeProps, Playground(), PlaygroundProps, ResponseState, RouteDetail(), RouteDetailProps (+17 more)

### Community 3 - "Root Workspace Config"
Cohesion: 0.07
Nodes (28): devDependencies, turbo, typescript, engines, node, pnpm, name, private (+20 more)

### Community 4 - "Parser Package Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, @flowdoc/core, glob, ts-morph, zod-to-json-schema, description, devDependencies, tsup (+19 more)

### Community 5 - "Bundled UI Assets"
Cohesion: 0.15
Nodes (20): cv(), dv(), ev(), fv(), Ho, iv(), m(), Mo() (+12 more)

### Community 6 - "CLI Feature Documentation"
Cohesion: 0.25
Nodes (8): esbuild — Allowed Build Dependency, examples/* Workspace Glob, pnpm Workspace Monorepo Config, packages/* Workspace Glob, examples/express-app — Working Demo, packages/cli — flowdoc CLI (npm published), packages/core — Shared Types and Schema Utilities, packages/parser — AST Route and Schema Extractor

### Community 7 - "CLI Generate & Config Loader"
Cohesion: 0.10
Nodes (30): findConfigFile(), loadConfig(), resolveConfig(), createDocsServerCore(), DocsServerCore, ErrorState, FlowDocServeOptions, MIME (+22 more)

### Community 8 - "UI Package Config"
Cohesion: 0.09
Nodes (21): dependencies, react, react-dom, description, devDependencies, autoprefixer, postcss, tailwindcss (+13 more)

### Community 9 - "Core Module Exports"
Cohesion: 0.09
Nodes (15): CONFIG_FILES, buildSpec(), groupByTag(), groupRoutes(), ApiGroup, FlowDocConfig, FlowDocSpec, HttpMethod (+7 more)

### Community 10 - "Zod Schema Extractor"
Cohesion: 0.20
Nodes (19): applyChainedCallsToSchema(), applyChainedValidations(), buildArraySchema(), buildChainedSchema(), buildEnumSchema(), buildLiteralSchema(), buildNumberSchema(), buildObjectSchema() (+11 more)

### Community 11 - "Core Package Manifest"
Cohesion: 0.12
Nodes (16): description, devDependencies, tsup, @types/node, typescript, exports, import, main (+8 more)

### Community 12 - "Example Express App"
Cohesion: 0.12
Nodes (16): dependencies, express, zod, devDependencies, flowdoc-gen, tsx, @types/express, typescript (+8 more)

### Community 13 - "Base TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, lib, module, moduleResolution (+7 more)

### Community 14 - "Express App Routes & Middleware"
Cohesion: 0.27
Nodes (8): app, validateBody(), authRouter, usersRouter, createPostSchema, createUserSchema, loginSchema, updateUserSchema

### Community 15 - "Yup Schema Extractor"
Cohesion: 0.29
Nodes (11): applyYupChain(), buildYupBase(), getNum(), getStr(), isYupExpr(), parseYupShape(), tryParse(), unwrapYupChain() (+3 more)

### Community 16 - "CLI Runtime Dependencies"
Cohesion: 0.22
Nodes (9): dependencies, chalk, chokidar, commander, glob, open, ora, ts-morph (+1 more)

### Community 17 - "UI TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, moduleResolution, outDir, extends, include

### Community 18 - "CLI TypeScript Config"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 19 - "Core TypeScript Config"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 20 - "Express App TypeScript Config"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 21 - "Parser TypeScript Config"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 29 - "Community 29"
Cohesion: 0.19
Nodes (17): buildDefaultResponses(), deduplicateRoutes(), extractFromMiddleware(), extractHandlerInfo(), extractJsDocTag(), extractPathParameters(), extractResponseSchemas(), extractRoutesFromFile() (+9 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (17): buildDefaultResponses(), buildParamParameters(), buildQueryParams(), buildRequestBody(), buildRouteDoc(), deduplicateRoutes(), extractPathParameters(), extractRouteSchema() (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (15): baseUrl Auto-Detection from Requests, CLI reference, Config reference, Express, Fastify, flowdoc, Hono, Install (+7 more)

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (12): Express Route Extraction (app.get, app.post, router.use), CLI reference, Config reference, flowdoc Express Middleware, flowdoc, flowdoc-gen npm Package, Install, License (+4 more)

### Community 33 - "Community 33"
Cohesion: 0.17
Nodes (12): devDependencies, fastify, @flowdoc/core, @flowdoc/parser, @flowdoc/ui, hono, koa, tsup (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.22
Nodes (9): optional, optional, optional, optional, peerDependenciesMeta, express, fastify, hono (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (6): scripts, build, build:ui, clean, copy:assets, dev

### Community 36 - "Community 36"
Cohesion: 0.33
Nodes (6): defineConfig Function, flowdoc.config.ts Configuration, packages/ui — React Docs Viewer (Vite + Tailwind), __FLOWDOC_BRAND__ Runtime Brand Color Injection, flowdoc UI — React Docs Viewer Entry (index.html), packages/ui/src/main.tsx — UI Entry Point

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (6): Express, Fastify, Framework guides, Hono, Koa, NestJS

### Community 38 - "Community 38"
Cohesion: 0.40
Nodes (5): peerDependencies, express, fastify, hono, koa

### Community 39 - "Community 39"
Cohesion: 0.50
Nodes (4): author, email, name, url

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (3): publishConfig, access, registry

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (3): repository, type, url

## Knowledge Gaps
- **251 isolated node(s):** `config`, `name`, `version`, `private`, `type` (+246 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `generate()` connect `CLI Generate & Config Loader` to `Schema Parser Module`, `Core Module Exports`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `extractFastifyRoutes()` connect `Schema Parser Module` to `Community 30`, `CLI Generate & Config Loader`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `extractExpressRoutes()` connect `Schema Parser Module` to `Community 29`, `CLI Generate & Config Loader`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `flowdoc` (e.g. with `flowdoc.config.ts Configuration` and `packages/cli — flowdoc CLI (npm published)`) actually correct?**
  _`flowdoc` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `generate()` (e.g. with `findConfigFile()` and `loadConfig()`) actually correct?**
  _`generate()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `config`, `name`, `version` to the rest of the system?**
  _252 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CLI Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._