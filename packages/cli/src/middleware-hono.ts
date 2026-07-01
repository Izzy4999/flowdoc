import type { Context } from "hono";
import { createDocsServerCore, type FlowDocServeOptions } from "./docs-server-core.js";

export type FlowDocHonoOptions = FlowDocServeOptions;

/**
 * Hono middleware that serves flowdoc docs at whatever route you mount it on.
 * Hono has no automatic mount-path stripping, so pass `path` matching the
 * route prefix you register the handler under.
 *
 * Usage:
 *   import { flowdocHono } from "flowdoc-gen";
 *   app.get("/docs/*", flowdocHono({ path: "/docs" }));
 */
export const flowdocHono = (opts: FlowDocHonoOptions = {}) => {
  const core = createDocsServerCore(opts);
  const mountPath = opts.path ?? "";

  return async (c: Context): Promise<Response> => {
    if (core.disabled) {
      return c.text("API docs are not available in this environment.", 403);
    }

    const state = await core.ready();
    if (!state.ok) {
      return c.text(`flowdoc init failed: ${state.error}`, 500);
    }

    const fullPath = c.req.path;
    const relativePath =
      mountPath && fullPath.startsWith(mountPath) ? fullPath.slice(mountPath.length) : fullPath;
    const urlPath = relativePath === "" || relativePath === "/" ? "/index.html" : relativePath;

    // Serve index.html with baseUrl injected from the live request
    if (urlPath === "/index.html") {
      const url = new URL(c.req.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      return c.html(core.renderHtml({ baseUrl, docsBase: mountPath }));
    }

    const asset = core.resolveAsset(urlPath);
    if (!asset) {
      return c.text("Not found", 404);
    }

    return new Response(asset.content, { headers: { "Content-Type": asset.mime } });
  };
};
