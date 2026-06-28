import {
  Project,
  Node,
  SyntaxKind,
  type ClassDeclaration,
  type MethodDeclaration,
  type Decorator,
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

const HTTP_METHOD_DECORATORS: Record<string, HttpMethod> = {
  Get: "GET",
  Post: "POST",
  Put: "PUT",
  Patch: "PATCH",
  Delete: "DELETE",
  Head: "HEAD",
  Options: "OPTIONS",
};

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

const getDecoratorStringArg = (decorator: Decorator, argIndex = 0): string | null => {
  const args = decorator.getArguments();
  const arg = args[argIndex];
  if (!arg) return null;
  if (Node.isStringLiteral(arg)) return arg.getLiteralValue();
  if (Node.isNoSubstitutionTemplateLiteral(arg)) return arg.getLiteralValue();
  return null;
};

const getDecoratorObjectArg = (decorator: Decorator): Record<string, unknown> | null => {
  const args = decorator.getArguments();
  const arg = args[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) return null;
  const result: Record<string, unknown> = {};
  for (const prop of arg.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getNameNode().getText().replace(/['"]/g, "");
    const init = prop.getInitializer();
    if (!init) continue;
    if (Node.isStringLiteral(init)) result[name] = init.getLiteralValue();
    else if (Node.isNumericLiteral(init)) result[name] = Number(init.getLiteralValue());
    else if (init.getKind() === SyntaxKind.TrueKeyword) result[name] = true;
    else if (init.getKind() === SyntaxKind.FalseKeyword) result[name] = false;
    else result[name] = init.getText().replace(/['"]/g, "");
  }
  return result;
};

const normalizePath = (prefix: string, path: string): string => {
  const combined = `/${prefix}/${path}`.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  return combined;
};

const extractPathParameters = (path: string): RouteParameter[] => {
  const paramRegex = /:(\w+)/g;
  const params: RouteParameter[] = [];
  let match: RegExpExecArray | null;
  while ((match = paramRegex.exec(path)) !== null) {
    const name = match[1];
    if (name) params.push({ name, in: "path", required: true, schema: { type: "string" } });
  }
  return params;
};

const inferTagsFromPath = (path: string): string[] => {
  const segments = path.split("/").filter(Boolean);
  const tag = segments.find((s) => !s.startsWith(":"));
  return tag ? [tag] : ["default"];
};

const mergeParameters = (
  fromMethod: RouteParameter[],
  fromPath: RouteParameter[]
): RouteParameter[] => {
  const existing = new Set(fromMethod.map((p) => `${p.in}:${p.name}`));
  const merged = [...fromMethod];
  for (const param of fromPath) {
    if (!existing.has(`${param.in}:${param.name}`)) merged.push(param);
  }
  return merged;
};

const buildDefaultResponses = (method: HttpMethod, httpCode?: number): RouteDoc["responses"] => {
  const successCode =
    httpCode?.toString() ??
    (method === "POST" ? "201" : method === "DELETE" ? "204" : "200");
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

const deduplicateRoutes = (routes: RouteDoc[]): RouteDoc[] => {
  const seen = new Set<string>();
  return routes.filter((r) => {
    const key = `${r.method}:${r.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const extractMethodParameters = (
  method: MethodDeclaration,
  schemas: Record<string, JsonSchema>
): { parameters: RouteParameter[]; requestBody: RequestBody | null } => {
  const parameters: RouteParameter[] = [];
  let requestBody: RequestBody | null = null;

  for (const param of method.getParameters()) {
    const bodyDec = param.getDecorator("Body");
    const queryDec = param.getDecorator("Query");
    const nestParamDec = param.getDecorator("Param");
    const headerDec = param.getDecorator("Headers");

    const typeText = param.getTypeNode()?.getText();

    if (bodyDec) {
      const fieldName = getDecoratorStringArg(bodyDec);
      if (fieldName) {
        // @Body('field') — single field extraction, treat as a body param
        parameters.push({ name: fieldName, in: "query", required: false, schema: { type: "string" } });
        continue;
      }
      // @Body() dto: SomeDto
      let schema: JsonSchema = { type: "object" };
      if (typeText && schemas[typeText]) {
        schema = schemas[typeText]!;
      } else {
        // Fall back to @ApiBody({ type: SomeDto }) on the method
        const apiBodyDec = method.getDecorator("ApiBody");
        if (apiBodyDec) {
          const obj = getDecoratorObjectArg(apiBodyDec);
          const typeName = obj?.["type"] as string | undefined;
          if (typeName && schemas[typeName]) schema = schemas[typeName]!;
        }
      }
      requestBody = { required: true, content: { "application/json": { schema } } };
    } else if (queryDec) {
      const fieldName = getDecoratorStringArg(queryDec);
      if (fieldName) {
        parameters.push({ name: fieldName, in: "query", required: false, schema: { type: "string" } });
      } else if (typeText && schemas[typeText]) {
        // @Query() dto: FilterDto — expand DTO properties as individual query params
        const dtoSchema = schemas[typeText]!;
        if (dtoSchema.type === "object" && dtoSchema.properties) {
          for (const [name, propSchema] of Object.entries(dtoSchema.properties)) {
            parameters.push({
              name,
              in: "query",
              required: dtoSchema.required?.includes(name) ?? false,
              schema: propSchema,
            });
          }
        }
      }
    } else if (nestParamDec) {
      const fieldName = getDecoratorStringArg(nestParamDec);
      if (fieldName) {
        parameters.push({ name: fieldName, in: "path", required: true, schema: { type: "string" } });
      }
    } else if (headerDec) {
      const fieldName = getDecoratorStringArg(headerDec);
      if (fieldName) {
        parameters.push({ name: fieldName, in: "header", required: false, schema: { type: "string" } });
      }
    }
  }

  // @ApiBody on the method level as last resort when no @Body() param was found
  if (!requestBody) {
    const apiBodyDec = method.getDecorator("ApiBody");
    if (apiBodyDec) {
      const obj = getDecoratorObjectArg(apiBodyDec);
      const typeName = obj?.["type"] as string | undefined;
      const schema: JsonSchema =
        typeName && schemas[typeName] ? schemas[typeName]! : { type: "object" };
      requestBody = { required: true, content: { "application/json": { schema } } };
    }
  }

  return { parameters, requestBody };
};

const extractRouteFromMethod = (
  method: MethodDeclaration,
  controllerPrefix: string,
  controllerTags: string[],
  schemas: Record<string, JsonSchema>
): RouteDoc | null => {
  let httpMethod: HttpMethod | null = null;
  let methodPath = "";

  for (const [decoratorName, verb] of Object.entries(HTTP_METHOD_DECORATORS)) {
    const dec = method.getDecorator(decoratorName);
    if (dec) {
      httpMethod = verb;
      methodPath = getDecoratorStringArg(dec) ?? "";
      break;
    }
  }

  if (!httpMethod) return null;

  const path = normalizePath(controllerPrefix, methodPath);

  // @HttpCode(201)
  const httpCodeDec = method.getDecorator("HttpCode");
  const httpCodeRaw = httpCodeDec ? getDecoratorStringArg(httpCodeDec) : null;
  const httpCode = httpCodeRaw !== null ? Number(httpCodeRaw) : undefined;

  // @ApiOperation({ summary, description })
  const apiOpDec = method.getDecorator("ApiOperation");
  const apiOpObj = apiOpDec ? getDecoratorObjectArg(apiOpDec) : null;
  const summary = apiOpObj?.["summary"] as string | undefined;
  const description = apiOpObj?.["description"] as string | undefined;

  // Tags: @ApiTags on method overrides controller-level tags
  const methodTagsDec = method.getDecorator("ApiTags");
  const tags: string[] = methodTagsDec
    ? methodTagsDec
        .getArguments()
        .map((a) => (Node.isStringLiteral(a) ? a.getLiteralValue() : a.getText().replace(/['"]/g, "")))
    : controllerTags.length > 0
    ? controllerTags
    : inferTagsFromPath(path);

  // @ApiExcludeEndpoint
  const deprecated = !!method.getDecorator("ApiExcludeEndpoint");

  const { parameters, requestBody } = extractMethodParameters(method, schemas);
  const pathParamsFromString = extractPathParameters(path);
  const mergedParameters = mergeParameters(parameters, pathParamsFromString);

  // Build responses — overlay @ApiResponse decorators
  const responses = buildDefaultResponses(httpMethod, httpCode);
  for (const dec of method.getDecorators().filter((d) => d.getName() === "ApiResponse")) {
    const obj = getDecoratorObjectArg(dec);
    if (!obj) continue;
    const status = String(obj["status"] ?? "200");
    const desc = String(obj["description"] ?? `HTTP ${status}`);
    responses[status] = { description: desc };
    const typeName = obj["type"] as string | undefined;
    if (typeName && schemas[typeName]) {
      responses[status]!.content = { "application/json": { schema: schemas[typeName]! } };
    }
  }

  const route: RouteDoc = {
    method: httpMethod,
    path,
    tags,
    parameters: mergedParameters,
    responses,
    ...(summary !== undefined ? { summary } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(requestBody !== null ? { requestBody } : {}),
    ...(deprecated ? { deprecated } : {}),
  };

  return route;
};

const extractRoutesFromController = (
  cls: ClassDeclaration,
  schemas: Record<string, JsonSchema>
): RouteDoc[] => {
  const controllerDec = cls.getDecorator("Controller");
  if (!controllerDec) return [];

  const controllerPrefix = getDecoratorStringArg(controllerDec) ?? "";

  const apiTagsDec = cls.getDecorator("ApiTags");
  const controllerTags: string[] = apiTagsDec
    ? apiTagsDec
        .getArguments()
        .map((a) => (Node.isStringLiteral(a) ? a.getLiteralValue() : a.getText().replace(/['"]/g, "")))
    : [];

  return cls
    .getMethods()
    .map((m) => extractRouteFromMethod(m, controllerPrefix, controllerTags, schemas))
    .filter((r): r is RouteDoc => r !== null);
};

export const extractNestRoutes = async (config: FlowDocConfig): Promise<RouteDoc[]> => {
  const cwd =
    existsSync(config.entry) &&
    !config.entry.endsWith(".ts") &&
    !config.entry.endsWith(".js")
      ? config.entry
      : dirname(config.entry);

  const tsConfigPath = findTsConfig(cwd);
  const project = tsConfigPath
    ? new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: true })
    : new Project({
        compilerOptions: {
          allowJs: true,
          strict: false,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      });

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

  // Collect all validation schemas across the whole project first
  const globalSchemas: Record<string, JsonSchema> = {};
  for (const sourceFile of project.getSourceFiles()) {
    Object.assign(globalSchemas, extractZodSchemas(sourceFile));
    Object.assign(globalSchemas, extractYupSchemas(sourceFile));
    Object.assign(globalSchemas, extractJoiSchemas(sourceFile));
    Object.assign(globalSchemas, extractClassValidatorSchemas(sourceFile));
  }

  const allRoutes: RouteDoc[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    for (const cls of sourceFile.getClasses()) {
      allRoutes.push(...extractRoutesFromController(cls, globalSchemas));
    }
  }

  return deduplicateRoutes(allRoutes);
};
