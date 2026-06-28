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
  // Hono supports :param and *wildcard styles
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
  const tag = segments.find((s) => !s.startsWith(":") && s !== "*");
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

// Extract schema from zValidator('json'|'query'|'param', schema) middleware
const extractZValidator = (
  middlewareArgs: Expression[],
  schemas: Record<string, JsonSchema>
): { requestBody: RequestBody | null; queryParams: RouteParameter[] } => {
  let requestBody: RequestBody | null = null;
  const queryParams: RouteParameter[] = [];

  for (const arg of middlewareArgs) {
    if (!Node.isCallExpression(arg)) continue;
    const callee = arg.getExpression();
    const calleeName = Node.isIdentifier(callee)
      ? callee.getText()
      : Node.isPropertyAccessExpression(callee)
      ? callee.getName()
      : null;

    // zValidator('json'|'form'|'query'|'param', schema)
    if (calleeName === "zValidator" || calleeName === "validator") {
      const vArgs = arg.getArguments();
      if (vArgs.length < 2) continue;
      const targetArg = vArgs[0];
      const schemaArg = vArgs[1];
      if (!targetArg || !schemaArg) continue;

      const target = Node.isStringLiteral(targetArg) ? targetArg.getLiteralValue() : null;
      const schemaName = Node.isIdentifier(schemaArg) ? schemaArg.getText() : null;
      const resolvedSchema = schemaName ? schemas[schemaName] : null;

      if (target === "json" || target === "form") {
        const schema: JsonSchema = resolvedSchema ?? { type: "object" };
        requestBody = { required: true, content: { "application/json": { schema } } };
      } else if (target === "query" && resolvedSchema?.type === "object" && resolvedSchema.properties) {
        for (const [name, propSchema] of Object.entries(resolvedSchema.properties)) {
          queryParams.push({
            name,
            in: "query",
            required: resolvedSchema.required?.includes(name) ?? false,
            schema: propSchema,
          });
        }
      }
    }
  }

  return { requestBody, queryParams };
};

const tryExtractHonoRoute = (
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
  if (!firstArg || !Node.isStringLiteral(firstArg)) return null;

  const path = normalizePath(firstArg.getLiteralValue());
  const method = methodName as HttpMethod;

  // All args between path and final handler are middleware
  const middlewareArgs = args.slice(1, -1) as Expression[];
  const { requestBody, queryParams } = extractZValidator(middlewareArgs, schemas);

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

export const extractHonoRoutes = async (config: FlowDocConfig): Promise<RouteDoc[]> => {
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
      const route = tryExtractHonoRoute(call, globalSchemas);
      if (route) allRoutes.push(route);
    }
  }

  return deduplicateRoutes(allRoutes);
};
