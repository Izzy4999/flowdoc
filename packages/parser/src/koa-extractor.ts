import {
  Project,
  Node,
  SyntaxKind,
  type CallExpression,
  type Expression,
} from "ts-morph";
import { glob } from "glob";
import { dirname, join } from "path";
import { existsSync } from "fs";
import type {
  RouteDoc,
  HttpMethod,
  JsonSchema,
  RouteParameter,
  RequestBody,
  FlowDocConfig,
} from "@flowdoc/core";
import { extractZodSchemas } from "./zod-extractor.js";
import { extractYupSchemas } from "./yup-extractor.js";
import { extractJoiSchemas } from "./joi-extractor.js";
import { extractClassValidatorSchemas } from "./class-validator-extractor.js";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

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
  // koa-router uses :param style
  const paramRegex = /:(\w+)/g;
  const params: RouteParameter[] = [];
  let match: RegExpExecArray | null;
  while ((match = paramRegex.exec(path)) !== null) {
    if (match[1]) params.push({ name: match[1], in: "path", required: true, schema: { type: "string" } });
  }
  return params;
};

const inferTagsFromPath = (path: string): string[] => {
  const segments = path.split("/").filter(Boolean);
  const tag = segments.find((s) => !s.startsWith(":"));
  return tag ? [tag] : ["default"];
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

// Detect common Koa validation middleware patterns:
// validate(schema), validateBody(schema), koaBody({ ... }), bodyParser(),
// koa-joi-router and koa-zod-router style: router.validate(schema)
const extractFromMiddleware = (
  middleware: Expression[],
  schemas: Record<string, JsonSchema>
): { requestBody: RequestBody | null; queryParams: RouteParameter[] } => {
  let requestBody: RequestBody | null = null;
  const queryParams: RouteParameter[] = [];

  for (const mw of middleware) {
    const text = mw.getText();

    // Body schema middleware
    const bodyMatch =
      text.match(/(?:validateBody|validate|bodyValidator|checkBody|schemaValidator)\((\w+)\)/) ??
      text.match(/celebrate\s*\(\s*\{\s*body\s*:\s*(\w+)/);
    if (bodyMatch) {
      const schemaName = bodyMatch[1];
      const schema = schemaName ? schemas[schemaName] : null;
      if (schema) {
        requestBody = { required: true, content: { "application/json": { schema } } };
      }
    }

    // Query param middleware
    const queryMatch = text.match(/(?:validateQuery|queryValidator|checkQuery)\((\w+)\)/);
    if (queryMatch) {
      const schemaName = queryMatch[1];
      const schema = schemaName ? schemas[schemaName] : null;
      if (schema?.type === "object" && schema.properties) {
        for (const [name, propSchema] of Object.entries(schema.properties)) {
          queryParams.push({
            name,
            in: "query",
            required: schema.required?.includes(name) ?? false,
            schema: propSchema,
          });
        }
      }
    }
  }

  return { requestBody, queryParams };
};

const tryExtractKoaRoute = (
  call: CallExpression,
  schemas: Record<string, JsonSchema>
): RouteDoc | null => {
  const expr = call.getExpression();
  if (!Node.isPropertyAccessExpression(expr)) return null;

  const methodName = expr.getName().toUpperCase();
  if (!HTTP_METHODS.includes(methodName as HttpMethod)) return null;

  const args = call.getArguments();
  if (args.length < 2) return null;

  const firstArg = args[0];
  if (
    !firstArg ||
    (!Node.isStringLiteral(firstArg) &&
      !Node.isNoSubstitutionTemplateLiteral(firstArg))
  ) {
    return null;
  }

  const path = normalizePath(firstArg.getText().replace(/['"'`]/g, ""));
  const method = methodName as HttpMethod;

  const middlewareArgs = args.slice(1, -1) as Expression[];
  const { requestBody, queryParams } = extractFromMiddleware(middlewareArgs, schemas);

  const pathParameters = extractPathParameters(path);
  const allParameters = [
    ...queryParams,
    ...pathParameters.filter((p) => !queryParams.some((q) => q.name === p.name)),
  ];

  const route: RouteDoc = {
    method,
    path,
    tags: inferTagsFromPath(path),
    parameters: allParameters,
    responses: buildDefaultResponses(method),
  };
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

export const extractKoaRoutes = async (config: FlowDocConfig): Promise<RouteDoc[]> => {
  const cwd =
    existsSync(config.entry) && !config.entry.endsWith(".ts") && !config.entry.endsWith(".js")
      ? config.entry
      : dirname(config.entry);

  const tsConfigPath = findTsConfig(cwd);
  const project = tsConfigPath
    ? new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true })
    : new Project({ compilerOptions: { allowJs: true, strict: false } });

  const files = await glob(`${cwd}/**/*.{ts,js}`, {
    ignore: ["**/node_modules/**", "**/dist/**", "**/*.d.ts", "**/*.spec.*", "**/*.test.*"],
  });

  for (const file of files) project.addSourceFileAtPath(file);

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
      const route = tryExtractKoaRoute(call, globalSchemas);
      if (route) allRoutes.push(route);
    }
  }

  return deduplicateRoutes(allRoutes);
};
