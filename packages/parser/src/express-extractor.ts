import {
  Project,
  Node,
  SourceFile,
  type CallExpression,
  type Expression,
  type ObjectLiteralExpression,
  SyntaxKind,
} from "ts-morph";
import { glob } from "glob";
import { resolve, dirname, join } from "path";
import { existsSync } from "fs";
import type { RouteDoc, HttpMethod, JsonSchema, RouteParameter, RequestBody, FlowDocConfig } from "@flowdoc/core";
import { extractZodSchemas } from "./zod-extractor.js";
import { extractYupSchemas } from "./yup-extractor.js";
import { extractJoiSchemas } from "./joi-extractor.js";
import { extractClassValidatorSchemas } from "./class-validator-extractor.js";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

interface ParseContext {
  zodSchemas: Record<string, JsonSchema>;
  routerPrefix: string;
}

/**
 * Main entry: given the resolved config, scan all source files and extract routes.
 */
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

export const extractExpressRoutes = async (config: FlowDocConfig): Promise<RouteDoc[]> => {
  // entry may be a file or a directory — normalise to the directory
  const cwd = existsSync(config.entry) && !config.entry.endsWith(".ts") && !config.entry.endsWith(".js")
    ? config.entry
    : dirname(config.entry);

  const tsConfigPath = findTsConfig(cwd);

  const project = tsConfigPath
    ? new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true })
    : new Project({ compilerOptions: { allowJs: true, strict: false } });

  // Add all TS/JS files in the project
  const patterns = ["**/*.ts", "**/*.js"].map((p) => resolve(cwd, "**", p));
  const files = await glob(`${cwd}/**/*.{ts,js}`, {
    ignore: ["**/node_modules/**", "**/dist/**", "**/*.d.ts", "**/*.spec.*", "**/*.test.*"],
  });

  for (const file of files) {
    project.addSourceFileAtPath(file);
  }

  // Collect schemas from ALL supported validation libraries across every file first
  const globalSchemas: Record<string, JsonSchema> = {};
  for (const sourceFile of project.getSourceFiles()) {
    Object.assign(globalSchemas, extractZodSchemas(sourceFile));
    Object.assign(globalSchemas, extractYupSchemas(sourceFile));
    Object.assign(globalSchemas, extractJoiSchemas(sourceFile));
    Object.assign(globalSchemas, extractClassValidatorSchemas(sourceFile));
  }

  const allRoutes: RouteDoc[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const ctx: ParseContext = { zodSchemas: globalSchemas, routerPrefix: "" };
    const routes = extractRoutesFromFile(sourceFile, ctx);
    allRoutes.push(...routes);
  }

  return deduplicateRoutes(allRoutes);
};

const extractRoutesFromFile = (sourceFile: SourceFile, ctx: ParseContext): RouteDoc[] => {
  const routes: RouteDoc[] = [];
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const route = tryExtractRoute(call, ctx);
    if (route) routes.push(route);
  }

  return routes;
};

const tryExtractRoute = (call: CallExpression, ctx: ParseContext): RouteDoc | null => {
  const expr = call.getExpression();
  if (!Node.isPropertyAccessExpression(expr)) return null;

  const methodName = expr.getName().toUpperCase();
  if (!HTTP_METHODS.includes(methodName as HttpMethod)) return null;

  const args = call.getArguments();
  if (args.length < 2) return null;

  const firstArg = args[0];
  if (!firstArg) return null;

  // Extract path — must be a string literal
  if (
    !Node.isStringLiteral(firstArg) &&
    !Node.isTemplateExpression(firstArg) &&
    !Node.isNoSubstitutionTemplateLiteral(firstArg)
  ) {
    return null;
  }

  const rawPath = firstArg.getText().replace(/['"'`]/g, "");
  const path = normalizePath(ctx.routerPrefix, rawPath);
  const method = methodName as HttpMethod;

  // The remaining args are middleware + the final handler
  const middlewareArgs = args.slice(1, -1) as Expression[];
  const handlerArg = args[args.length - 1] as Expression;

  const { requestBody, parameters } = extractFromMiddleware(middlewareArgs, ctx);
  const pathParams = extractPathParameters(path);
  const handlerInfo = extractHandlerInfo(handlerArg);
  const responseSchemas = extractResponseSchemas(handlerArg);

  // Merge path params that weren't already in middleware-extracted params
  const allParameters = mergeParameters(parameters, pathParams);

  const tags = inferTags(path);

  // Build responses: start with defaults, overlay inferred schemas
  const responses = buildDefaultResponses(method);
  for (const [code, schema] of Object.entries(responseSchemas)) {
    const existing = responses[code] ?? { description: `HTTP ${code}` };
    responses[code] = {
      ...existing,
      content: { "application/json": { schema } },
    };
  }

  const route: RouteDoc = {
    method,
    path,
    tags,
    parameters: allParameters,
    responses,
    middleware: middlewareArgs.map((m) => m.getText()),
  };
  if (handlerInfo.summary !== undefined) route.summary = handlerInfo.summary;
  if (handlerInfo.description !== undefined) route.description = handlerInfo.description;
  if (requestBody !== null) route.requestBody = requestBody;
  return route;
};

const extractFromMiddleware = (
  middleware: Expression[],
  ctx: ParseContext
): { requestBody: RequestBody | null; parameters: RouteParameter[] } => {
  let requestBody: RequestBody | null = null;
  const parameters: RouteParameter[] = [];

  for (const mw of middleware) {
    const text = mw.getText();

    // Body schema middleware — matches: validate(schema), validateBody(schema),
    // zodValidate(schema), joiValidate(schema), validateDto(CreateUserDto),
    // celebrate({ body: schema }), bodyValidator(schema), checkBody(schema)
    const bodyMatch =
      text.match(/(?:validateBody|validate|zodValidate|joiValidate|validateDto|bodyValidator|checkBody|schemaValidator)\((\w+)\)/) ??
      text.match(/celebrate\s*\(\s*\{\s*body\s*:\s*(\w+)/);
    if (bodyMatch) {
      const schemaName = bodyMatch[1];
      const schema = schemaName ? ctx.zodSchemas[schemaName] : null;
      if (schema) {
        requestBody = {
          required: true,
          content: { "application/json": { schema } },
        };
      }
    }

    // Query param middleware — matches: validateQuery(schema), queryValidator(schema), checkQuery(schema)
    const queryMatch = text.match(/(?:validateQuery|queryValidator|checkQuery)\((\w+)\)/);
    if (queryMatch) {
      const schemaName = queryMatch[1];
      const schema = schemaName ? ctx.zodSchemas[schemaName] : null;
      if (schema?.type === "object" && schema.properties) {
        for (const [name, propSchema] of Object.entries(schema.properties)) {
          parameters.push({
            name,
            in: "query",
            required: schema.required?.includes(name) ?? false,
            schema: propSchema,
          });
        }
      }
    }
  }

  return { requestBody, parameters };
};

const extractPathParameters = (path: string): RouteParameter[] => {
  const paramRegex = /:(\w+)/g;
  const params: RouteParameter[] = [];
  let match: RegExpExecArray | null;

  while ((match = paramRegex.exec(path)) !== null) {
    const name = match[1];
    if (name) {
      params.push({
        name,
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    }
  }

  return params;
};

const extractResponseSchemas = (
  handler: Expression
): Record<string, JsonSchema> => {
  const result: Record<string, JsonSchema> = {};
  const calls = handler.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of calls) {
    const expr = call.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) continue;

    const methodName = expr.getName();
    if (methodName !== "json" && methodName !== "send") continue;

    // Determine status code: res.status(201).json(...) → "201", res.json(...) → "200"
    let statusCode = "200";
    const callee = expr.getExpression();
    if (Node.isCallExpression(callee)) {
      const statusExpr = callee.getExpression();
      if (
        Node.isPropertyAccessExpression(statusExpr) &&
        statusExpr.getName() === "status"
      ) {
        const statusArg = callee.getArguments()[0];
        if (statusArg && Node.isNumericLiteral(statusArg)) {
          statusCode = statusArg.getText();
        }
      }
    }

    const args = call.getArguments();
    if (args.length === 0) continue;
    const arg = args[0];
    if (!arg || !Node.isObjectLiteralExpression(arg)) continue;

    const schema = schemaFromObjectLiteral(arg);
    if (schema && Object.keys(schema.properties ?? {}).length > 0) {
      // Keep the first occurrence per status code
      if (!result[statusCode]) result[statusCode] = schema;
    }
  }

  return result;
};

const schemaFromObjectLiteral = (obj: ObjectLiteralExpression): JsonSchema => {
  const properties: Record<string, JsonSchema> = {};
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getNameNode().getText().replace(/['"]/g, "");
    const init = prop.getInitializer();
    if (!init) continue;
    properties[name] = schemaFromValue(init);
  }
  return { type: "object", properties };
};

const schemaFromValue = (expr: Expression): JsonSchema => {
  if (Node.isStringLiteral(expr) || Node.isTemplateExpression(expr) || Node.isNoSubstitutionTemplateLiteral(expr))
    return { type: "string", example: Node.isStringLiteral(expr) ? expr.getLiteralValue() : undefined };
  if (Node.isNumericLiteral(expr))
    return { type: "number", example: Number(expr.getLiteralValue()) };
  if (expr.getKind() === SyntaxKind.TrueKeyword || expr.getKind() === SyntaxKind.FalseKeyword)
    return { type: "boolean", example: expr.getKind() === SyntaxKind.TrueKeyword };
  if (Node.isNullLiteral(expr))
    return { type: "null" };
  if (Node.isArrayLiteralExpression(expr)) {
    const items = expr.getElements()[0];
    return { type: "array", items: items ? schemaFromValue(items) : {} };
  }
  if (Node.isObjectLiteralExpression(expr))
    return schemaFromObjectLiteral(expr);
  // Identifier or complex expression — treat as unknown
  return {};
};

const extractHandlerInfo = (
  handler: Expression
): { summary?: string; description?: string } => {
  // Try to extract JSDoc from an arrow function or function declaration
  const leadingComments = handler.getLeadingCommentRanges();
  if (leadingComments.length === 0) return {};

  const comment = leadingComments[leadingComments.length - 1];
  if (!comment) return {};
  const text = comment.getText();

  const summary = extractJsDocTag(text, null);
  const description = extractJsDocTag(text, "description");

  const result: { summary?: string; description?: string } = {};
  if (summary !== null) result.summary = summary;
  if (description !== null) result.description = description;
  return result;
};

const extractJsDocTag = (comment: string, tag: string | null): string | null => {
  if (tag === null) {
    // First line description
    const match = comment.match(/\/\*\*\s*\n?\s*\*\s*(.+)/);
    return match?.[1]?.trim() ?? null;
  }
  const match = comment.match(new RegExp(`@${tag}\\s+(.+)`));
  return match?.[1]?.trim() ?? null;
};

const mergeParameters = (
  fromMiddleware: RouteParameter[],
  fromPath: RouteParameter[]
): RouteParameter[] => {
  const existing = new Set(fromMiddleware.map((p) => `${p.in}:${p.name}`));
  const merged = [...fromMiddleware];
  for (const param of fromPath) {
    if (!existing.has(`${param.in}:${param.name}`)) {
      merged.push(param);
    }
  }
  return merged;
};

const normalizePath = (prefix: string, path: string): string => {
  const combined = `${prefix}${path}`.replace(/\/+/g, "/");
  return combined.startsWith("/") ? combined : `/${combined}`;
};

const inferTags = (path: string): string[] => {
  const segments = path.split("/").filter(Boolean);
  // Use the first non-param segment as the tag
  const tag = segments.find((s) => !s.startsWith(":"));
  return tag ? [tag] : ["default"];
};

const buildDefaultResponses = (method: HttpMethod): RouteDoc["responses"] => {
  const responses: RouteDoc["responses"] = {
    "200": { description: method === "DELETE" ? "Success" : "Successful response" },
    "400": { description: "Bad request" },
    "401": { description: "Unauthorized" },
    "500": { description: "Internal server error" },
  };

  if (method === "POST") {
    responses["201"] = { description: "Created" };
  }

  if (method === "DELETE") {
    responses["204"] = { description: "No content" };
  }

  return responses;
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
