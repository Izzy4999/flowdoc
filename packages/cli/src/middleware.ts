import type { Request, Response, NextFunction } from "express";
import { createDocsServerCore, type FlowDocServeOptions } from "./docs-server-core.js";

export type FlowDocMiddlewareOptions = FlowDocServeOptions;

/**
 * Express middleware that serves flowdoc docs at whatever route you mount it on.
 * baseUrl is auto-derived from each incoming request — no manual config needed.
 *
 * Usage:
 *   import { flowdoc } from "flowdoc-gen";
 *   app.use("/docs", flowdoc());
 */
export const flowdoc = (opts: FlowDocMiddlewareOptions = {}) => {
  const core = createDocsServerCore(opts);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (core.disabled) {
      res.status(403).send("API docs are not available in this environment.");
      return;
    }

    const state = await core.ready();
    if (!state.ok) {
      res.status(500).send(`flowdoc init failed: ${state.error}`);
      return;
    }

    const urlPath = req.path === "/" || req.path === "" ? "/index.html" : req.path;

    // Serve index.html with baseUrl injected from the live request
    if (urlPath === "/index.html") {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      // req.baseUrl is the mount prefix ("/docs") — needed so relative asset
      // paths resolve correctly whether or not the browser adds a trailing slash
      const docsBase = req.baseUrl || "";
      res.setHeader("Content-Type", "text/html");
      res.send(core.renderHtml({ baseUrl, docsBase }));
      return;
    }

    const asset = core.resolveAsset(urlPath);
    if (!asset) {
      next();
      return;
    }

    res.setHeader("Content-Type", asset.mime);
    res.send(asset.content);
  };
};
