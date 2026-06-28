import {
  Project,
  Node,
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
  type Expression,
} from "ts-morph";
import { glob } from "glob";
import { dirname, join } from "path";
import { existsSync } from "fs";
import type {
  RouteDoc,
  HttpMethod,
  JsonSchema,
  SchemaType,
  RouteParameter,
  RequestBody,
  FlowDocConfig,
} from "@flowdoc/core";
import { extractZodSchemas } from "./zod-extractor.js";
import { extractYupSchemas } from "./yup-extractor.js";
import { extractJoiSchemas } from "./joi-extractor.js";
import { extractClassValidatorSchemas } from "./class-validator-extractor.js";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const HTTP_METHOD_LOWER = new Set(HTTP_METHODS.map((m) => m.toLowerCase()));

const findTsConfig = (startDir: string): string | undefined => {
  let dir = startDir;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "tsconfig.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
};

const normalizePath = (path: string): string => {
  const normalized = path.replace(/\/+/g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};

const extractPathParameters = (path: string): RouteParameter[] => {
  const params: RouteParameter[] = [];
  // Fastify supports both :param and {param} style
  const colonRegex = /:(\w+)/g;
  const braceRegex = /\{(\w+)\}/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = colonRegex.exec(path)) !== null) {
    if (match[1] && !seen.has(match[1])) {
      seen.add(match[1]);
      params.push({ name: match[1], in: "path", required: true, schema: { type: "string" } });
    }
  }
  while ((match = braceRegex.exec(path)) !== null) {
    if (match[1] && !seen.has(match[1])) {
      seen.add(match[1]);
      params.push({ name: match[1], in: "path", required: true, schema: { type: "string" } });
    }
  }
  return params;
};

const inferTagsFromPath = (path: string): string[] => {
  const segments = path.split("/").filter(Boolean);
  const tag = segments.find((s) => !s.startsWith(":") && !s.startsWith("{"));
  return tag ? [tag] : ["default"];
};

// Parse a plain JSON Schema object literal into a JsonSchema value.
// Handles TypeBox Type.Object calls by returning an empty object schema.
const parseSchemaExpr = (expr: Expression): JsonSchema => {
  if (Node.isObjectLiteralExpression(expr)) return parseSchemaObj(expr);
  // TypeBox / function call schema — skip static extraction
  return {};
};

const parseSchemaObj = (obj: ObjectLiteralExpression): JsonSchema => {
  const schema: JsonSchema = {};
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const key = prop.getNameNode().getText().replace(/['"]/g, "");
    const init = prop.getInitializer();
    if (!init) continue;
    switch (key) {
      case "type":
        if (Node.isStringLiteral(init)) schema.type = init.getLiteralValue() as SchemaType;
        break;
      case "description":
        if (Node.isStringLiteral(init)) schema.description = init.getLiteralValue();
        break;
      case "properties":
        if (Node.isObjectLiteralExpression(init)) {
          schema.properties = {};
          for (const pp of init.getProperties()) {
            if (!Node.isPropertyAssignment(pp)) continue;
            const pname = pp.getNameNode().getText().replace(/['"]/g, "");
            const pinit = pp.getInitializer();
            if (pinit) schema.properties[pname] = parseSchemaExpr(pinit);
          }
        }
        break;
      case "required":
        if (Node.isArrayLiteralExpression(init)) {
          schema.required = init
            .getElements()
            .filter(Node.isStringLiteral)
            .map((e) => e.getLiteralValue());
        }
        break;
      case "items":
        schema.items = parseSchemaExpr(init);
        break;
      case "enum":
        if (Node.isArrayLiteralExpression(init)) {
          schema.enum = init.getElements().map((e) => {
            if (Node.isStringLiteral(e)) return e.getLiteralValue();
            if (Node.isNumericLiteral(e)) return Number(e.getLiteralValue());
            return e.getText();
          });
        }
        break;
      case "minimum":
        if (Node.isNumericLiteral(init)) schema.minimum = Number(init.getLiteralValue());
        break;
      case "maximum":
        if (Node.isNumericLiteral(init)) schema.maximum = Number(init.getLiteralValue());
        break;
      case "minLength":
        if (Node.isNumericLiteral(init)) schema.minLength = Number(init.getLiteralValue());
        break;
      case "maxLength":
        if (Node.isNumericLiteral(init)) schema.maxLength = Number(init.getLiteralValue());
        break;
      case "format":
        if (Node.isStringLiteral(init)) schema.format = init.getLiteralValue();
        break;
    }
  }
  return schema;
};

interface FastifyRouteSchema {
  body: JsonSchema | null;
  querystring: JsonSchema | null;
  params: JsonSchema | null;
  response: Record<string, JsonSchema>;
}

const extractRouteSchema = (schemaObj: ObjectLiteralExpression): FastifyRouteSchema => {
  const result: FastifyRouteSchema = { body: null, querystring: null, params: null, response: {} };

  for (const prop of schemaObj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const key = prop.getNameNode().getText().replace(/['"]/g, "");
    const init = prop.getInitializer();
    if (!init) continue;

    if (key === "body") {
      result.body = parseSchemaExpr(init);
    } else if (key === "querystring" || key === "query") {
      result.querystring = parseSchemaExpr(init);
    } else if (key === "params") {
      result.params = parseSchemaExpr(init);
    } else if (key === "response" && Node.isObjectLiteralExpression(init)) {
      for (const rp of init.getProperties()) {
        if (!Node.isPropertyAssignment(rp)) continue;
        const status = rp.getNameNode().getText().replace(/['"]/g, "");
        const rinit = rp.getInitializer();
        if (rinit) result.response[status] = parseSchemaExpr(rinit);
      }
    }
  }

  return result;
};

const buildRequestBody = (bodySchema: JsonSchema): RequestBody => ({
  required: true,
  content: { "application/json": { schema: bodySchema } },
});

const buildQueryParams = (querystringSchema: JsonSchema): RouteParameter[] => {
  if (querystringSchema.type !== "object" || !querystringSchema.properties) return [];
  return Object.entries(querystringSchema.properties).map(([name, propSchema]) => ({
    name,
    in: "query" as const,
    required: querystringSchema.required?.includes(name) ?? false,
    schema: propSchema,
  }));
};

const buildParamParameters = (paramsSchema: JsonSchema): RouteParameter[] => {
  if (paramsSchema.type !== "object" || !paramsSchema.properties) return [];
  return Object.entries(paramsSchema.properties).map(([name, propSchema]) => ({
    name,
    in: "path" as const,
    required: true,
    schema: propSchema,
  }));
};

const buildDefaultResponses = (method: HttpMethod): RouteDoc["responses"] => {
  const successCode = method === "POST" ? "201" : method === "DELETE" ? "204" : "200";
  return {
    [successCode]: {
      description:
        method === "DELETE" ? "No content" : method === "POST" ? "Created" : "Successful response",
    },
    "400": { description: "Bad request" },
    "401": { description: "Unauthorized" },
    "500": { description: "Internal server error" },
  };
};

// fastify.get('/path', [opts,] handler) or fastify.route({ method, url, schema, handler })
const tryExtractFastifyRoute = (
  call: CallExpression,
  globalSchemas: Record<string, JsonSchema>
): RouteDoc | null => {
  const expr = call.getExpression();
  if (!Node.isPropertyAccessExpression(expr)) return null;

  const methodName = expr.getName().toLowerCase();

  // Handle fastify.route({ method, url, ... })
  if (methodName === "route") {
    const args = call.getArguments();
    const arg = args[0];
    if (!arg || !Node.isObjectLiteralExpression(arg)) return null;

    let routeMethod: HttpMethod | null = null;
    let routeUrl = "";
    let routeSchema: FastifyRouteSchema | null = null;

    for (const prop of arg.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;
      const key = prop.getNameNode().getText().replace(/['"]/g, "");
      const init = prop.getInitializer();
      if (!init) continue;

      if (key === "method" && Node.isStringLiteral(init)) {
        const m = init.getLiteralValue().toUpperCase();
        if (HTTP_METHODS.includes(m as HttpMethod)) routeMethod = m as HttpMethod;
      } else if ((key === "url" || key === "path") && Node.isStringLiteral(init)) {
        routeUrl = init.getLiteralValue();
      } else if (key === "schema" && Node.isObjectLiteralExpression(init)) {
        routeSchema = extractRouteSchema(init);
      }
    }

    if (!routeMethod || !routeUrl) return null;
    return buildRouteDoc(routeMethod, routeUrl, routeSchema, globalSchemas);
  }

  // Handle fastify.get/post/put/patch/delete/head/options('/path', [opts,] handler)
  if (!HTTP_METHOD_LOWER.has(methodName)) return null;
  const httpMethod = methodName.toUpperCase() as HttpMethod;

  const args = call.getArguments();
  if (args.length < 2) return null;

  const firstArg = args[0];
  if (!firstArg || !Node.isStringLiteral(firstArg)) return null;
  const path = firstArg.getLiteralValue();

  // Look for an options object containing `schema`
  let routeSchema: FastifyRouteSchema | null = null;
  for (let i = 1; i < args.length - 1; i++) {
    const arg = args[i];
    if (!arg || !Node.isObjectLiteralExpression(arg)) continue;
    const schemaProp = arg.getProperty("schema");
    if (
      schemaProp &&
      Node.isPropertyAssignment(schemaProp) &&
      Node.isObjectLiteralExpression(schemaProp.getInitializerOrThrow())
    ) {
      routeSchema = extractRouteSchema(
        schemaProp.getInitializerOrThrow() as ObjectLiteralExpression
      );
    }
  }

  return buildRouteDoc(httpMethod, path, routeSchema, globalSchemas);
};

const buildRouteDoc = (
  method: HttpMethod,
  rawPath: string,
  routeSchema: FastifyRouteSchema | null,
  _globalSchemas: Record<string, JsonSchema>
): RouteDoc => {
  const path = normalizePath(rawPath);
  const tags = inferTagsFromPath(path);
  const responses = buildDefaultResponses(method);

  let requestBody: RequestBody | undefined;
  const parameters: RouteParameter[] = [];

  if (routeSchema) {
    if (routeSchema.body) requestBody = buildRequestBody(routeSchema.body);
    if (routeSchema.querystring) parameters.push(...buildQueryParams(routeSchema.querystring));
    if (routeSchema.params) {
      parameters.push(...buildParamParameters(routeSchema.params));
    } else {
      parameters.push(...extractPathParameters(path));
    }
    for (const [status, schema] of Object.entries(routeSchema.response)) {
      const existing = responses[status] ?? { description: `HTTP ${status}` };
      responses[status] = { ...existing, content: { "application/json": { schema } } };
    }
  } else {
    parameters.push(...extractPathParameters(path));
  }

  const route: RouteDoc = { method, path, tags, parameters, responses };
  if (requestBody) route.requestBody = requestBody;
  return route;
};

const deduplicateRoutes = (routes: RouteDoc[]): RouteDoc[] => {
  const seen = new Set<string>();
  return routes.filter((r) => {
    const key = `${r.method}:${r.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const extractFastifyRoutes = async (config: FlowDocConfig): Promise<RouteDoc[]> => {
  const cwd =
    existsSync(config.entry) && !config.entry.endsWith(".ts") && !config.entry.endsWith(".js")
      ? config.entry
      : dirname(config.entry);

  const tsConfigPath = findTsConfig(cwd);
  const project = tsConfigPath
    ? new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true })
    : new Project({ compilerOptions: { allowJs: true, strict: false } });

  const files = await glob(`${cwd}/**/*.{ts,js}`, {
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.d.ts",
      "**/*.spec.*",
      "**/*.test.*",
    ],
  });

  for (const file of files) {
    project.addSourceFileAtPath(file);
  }

  const globalSchemas: Record<string, JsonSchema> = {};
  for (const sourceFile of project.getSourceFiles()) {
    Object.assign(globalSchemas, extractZodSchemas(sourceFile));
    Object.assign(globalSchemas, extractYupSchemas(sourceFile));
    Object.assign(globalSchemas, extractJoiSchemas(sourceFile));
    Object.assign(globalSchemas, extractClassValidatorSchemas(sourceFile));
  }

  const allRoutes: RouteDoc[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const route = tryExtractFastifyRoute(call, globalSchemas);
      if (route) allRoutes.push(route);
    }
  }

  return deduplicateRoutes(allRoutes);
};
