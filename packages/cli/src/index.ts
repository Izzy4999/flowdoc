export { generate } from "./generate.js";
export { serve } from "./serve.js";
export { init } from "./init.js";
export { flowdoc } from "./middleware.js";
export { flowdocFastify } from "./middleware-fastify.js";
export { flowdocKoa } from "./middleware-koa.js";
export { flowdocHono } from "./middleware-hono.js";
export type { GenerateOptions } from "./generate.js";
export type { ServeOptions } from "./serve.js";
export type { FlowDocMiddlewareOptions } from "./middleware.js";
export type { FlowDocFastifyOptions } from "./middleware-fastify.js";
export type { FlowDocKoaOptions } from "./middleware-koa.js";
export type { FlowDocHonoOptions } from "./middleware-hono.js";

// Re-export core types so users import only from "flowdoc-gen", not "@flowdoc/core"
export type { FlowDocConfig, JsonSchema, RouteDoc, FlowDocSpec } from "@flowdoc/core";

/** Type-safe config helper — use in flowdoc.config.ts */
export const defineConfig = (config: import("@flowdoc/core").FlowDocConfig): import("@flowdoc/core").FlowDocConfig => config;
