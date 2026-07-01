import type { Context, Next } from "koa";
import { createDocsServerCore, type FlowDocServeOptions } from "./docs-server-core.js";

export type FlowDocKoaOptions = FlowDocServeOptions;

/**
 * Koa middleware that serves flowdoc docs at whatever route you mount it on.
 * Mount with `koa-mount` (or an equivalent) so `ctx.path` is stripped to the
 * sub-path and `ctx.mountPath` carries the prefix for the HTML shell.
 *
 * Usage:
 *   import mount from "koa-mount";
 *   import { flowdocKoa } from "flowdoc-gen";
 *   app.use(mount("/docs", flowdocKoa()));
 */
export const flowdocKoa = (opts: FlowDocKoaOptions = {}) => {
  const core = createDocsServerCore(opts);

  return async (ctx: Context, next: Next): Promise<void> => {
    if (core.disabled) {
      ctx.status = 403;
      ctx.body = "API docs are not available in this environment.";
      return;
    }

    const state = await core.ready();
    if (!state.ok) {
      ctx.status = 500;
      ctx.body = `flowdoc init failed: ${state.error}`;
      return;
    }

    const urlPath = ctx.path === "/" || ctx.path === "" ? "/index.html" : ctx.path;

    // Serve index.html with baseUrl injected from the live request
    if (urlPath === "/index.html") {
      const baseUrl = `${ctx.protocol}://${ctx.host}`;
      // ctx.mountPath is set by koa-mount to the prefix ("/docs") this middleware runs under
      const docsBase = opts.path ?? (ctx as Context & { mountPath?: string }).mountPath ?? "";
      ctx.type = "html";
      ctx.body = core.renderHtml({ baseUrl, docsBase });
      return;
    }

    const asset = core.resolveAsset(urlPath);
    if (!asset) {
      await next();
      return;
    }

    ctx.type = asset.mime;
    ctx.body = asset.content;
  };
};
