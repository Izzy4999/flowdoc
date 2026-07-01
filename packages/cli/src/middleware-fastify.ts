import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { createDocsServerCore, type FlowDocServeOptions } from "./docs-server-core.js";

export type FlowDocFastifyOptions = FlowDocServeOptions;

/**
 * Fastify plugin that serves flowdoc docs at whatever prefix you register it under.
 *
 * Usage:
 *   import { flowdocFastify } from "flowdoc-gen";
 *   fastify.register(flowdocFastify, { prefix: "/docs" });
 */
export const flowdocFastify: FastifyPluginAsync<FlowDocFastifyOptions> = async (fastify, opts) => {
  const core = createDocsServerCore(opts);

  const handler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (core.disabled) {
      reply.status(403).send("API docs are not available in this environment.");
      return;
    }

    const state = await core.ready();
    if (!state.ok) {
      reply.status(500).send(`flowdoc init failed: ${state.error}`);
      return;
    }

    const tail = (request.params as Record<string, string>)["*"] ?? "";
    const urlPath = tail === "" ? "/index.html" : `/${tail}`;

    // Serve index.html with baseUrl injected from the live request
    if (urlPath === "/index.html") {
      const baseUrl = `${request.protocol}://${request.hostname}`;
      // fastify.prefix is the cumulative mount prefix ("/docs") for this plugin scope
      const docsBase = fastify.prefix;
      reply.type("text/html").send(core.renderHtml({ baseUrl, docsBase }));
      return;
    }

    const asset = core.resolveAsset(urlPath);
    if (!asset) {
      reply.status(404).send("Not found");
      return;
    }

    reply.type(asset.mime).send(asset.content);
  };

  fastify.get("/", handler);
  fastify.get("/*", handler);
};
