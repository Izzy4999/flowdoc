import { Node, SourceFile, type CallExpression, type Expression } from "ts-morph";
import type { JsonSchema } from "@flowdoc/core";

// Detects any identifier used as the Joi namespace:
// import Joi from 'joi'     → Joi.string()
// import * as Joi from 'joi'
// import J from 'joi'       → J.string()
const JOI_PRIMITIVES = new Set([
  "string", "number", "boolean", "object", "array", "date",
  "binary", "any", "alternatives", "link",
]);

export const joiNodeToJsonSchema = (node: Expression, joiId = "Joi"): JsonSchema => {
  if (!Node.isCallExpression(node)) return {};

  const chain = unwrapJoiChain(node, joiId);
  if (!chain.root) return {};

  const base = buildJoiBase(chain.rootMethod);
  applyJoiChain(chain.methods, base, joiId);
  return base;
};

interface JoiChain {
  root: Expression | null;
  rootMethod: string;
  methods: Array<{ name: string; args: Expression[] }>;
}

const unwrapJoiChain = (node: Expression, joiId: string): JoiChain => {
  const methods: JoiChain["methods"] = [];
  let current: Expression = node;

  while (Node.isCallExpression(current)) {
    const expr = current.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) {
      return { root: null, rootMethod: "", methods };
    }

    const obj = expr.getExpression();
    const methodName = expr.getName();

    if (Node.isIdentifier(obj) && obj.getText() === joiId && JOI_PRIMITIVES.has(methodName)) {
      return { root: current, rootMethod: methodName, methods };
    }

    methods.unshift({ name: methodName, args: current.getArguments() as Expression[] });
    current = obj as Expression;
  }

  return { root: null, rootMethod: "", methods };
};

const buildJoiBase = (method: string): JsonSchema => {
  switch (method) {
    case "string": return { type: "string" };
    case "number": return { type: "number" };
    case "boolean": return { type: "boolean" };
    case "date": return { type: "string", format: "date-time" };
    case "binary": return { type: "string", format: "binary" };
    case "array": return { type: "array" };
    case "object": return { type: "object" };
    default: return {};
  }
};

const applyJoiChain = (
  methods: Array<{ name: string; args: Expression[] }>,
  schema: JsonSchema,
  joiId: string
): void => {
  for (const { name, args } of methods) {
    switch (name) {
      case "required":
        (schema as JsonSchema & { __required?: boolean }).__required = true;
        break;
      case "optional":
      case "allow":
        schema.nullable = true;
        break;
      case "email":
        schema.format = "email";
        break;
      case "uri":
        schema.format = "uri";
        break;
      case "guid":
      case "uuid":
        schema.format = "uuid";
        break;
      case "isoDate":
        schema.format = "date-time";
        break;
      case "min": {
        const v = getNum(args[0]);
        if (v !== null) {
          if (schema.type === "string") schema.minLength = v;
          else if (schema.type === "array") schema.minItems = v;
          else schema.minimum = v;
        }
        break;
      }
      case "max": {
        const v = getNum(args[0]);
        if (v !== null) {
          if (schema.type === "string") schema.maxLength = v;
          else if (schema.type === "array") schema.maxItems = v;
          else schema.maximum = v;
        }
        break;
      }
      case "length": {
        const v = getNum(args[0]);
        if (v !== null && schema.type === "string") {
          schema.minLength = v;
          schema.maxLength = v;
        }
        break;
      }
      case "integer":
        schema.type = "integer";
        break;
      case "positive":
        schema.minimum = 0;
        break;
      case "negative":
        schema.maximum = 0;
        break;
      case "valid": {
        // Joi.string().valid('a', 'b') or Joi.string().valid(Joi.override, ...)
        const vals = args
          .map((a) => a.getText().replace(/['"]/g, ""))
          .filter((v) => !v.includes(".override"));
        if (vals.length > 0) schema.enum = vals;
        break;
      }
      case "items": {
        // Joi.array().items(Joi.string())
        const arg = args[0] as Expression | undefined;
        if (arg) schema.items = joiNodeToJsonSchema(arg, joiId);
        break;
      }
      case "keys": {
        // Joi.object().keys({ field: Joi.string().required() })
        const arg = args[0];
        if (arg && Node.isObjectLiteralExpression(arg)) {
          const { properties, required } = parseJoiKeys(arg, joiId);
          schema.type = "object";
          schema.properties = properties;
          if (required.length > 0) schema.required = required;
        }
        break;
      }
      case "description": {
        const s = getStr(args[0]);
        if (s) schema.description = s;
        break;
      }
      case "label": {
        const s = getStr(args[0]);
        if (s) schema.title = s;
        break;
      }
      case "default": {
        const arg = args[0];
        if (arg) schema.default = tryParse(arg.getText());
        break;
      }
      case "pattern": {
        const arg = args[0];
        if (arg) schema.pattern = arg.getText().replace(/^\/|\/[gimsuy]*$/g, "");
        break;
      }
    }
  }
};

const parseJoiKeys = (
  arg: ReturnType<Expression["asKind"]>,
  joiId: string
): { properties: Record<string, JsonSchema>; required: string[] } => {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  if (!arg || !Node.isObjectLiteralExpression(arg)) return { properties, required };

  for (const prop of arg.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getName();
    const init = prop.getInitializer();
    if (!init) continue;

    const childSchema = joiNodeToJsonSchema(init, joiId);
    const isReq = (childSchema as JsonSchema & { __required?: boolean }).__required === true;
    delete (childSchema as JsonSchema & { __required?: boolean }).__required;
    properties[name] = childSchema;
    if (isReq) required.push(name);
  }

  return { properties, required };
};

const getNum = (node: Expression | undefined): number | null => {
  if (!node) return null;
  const v = Number(node.getText());
  return isNaN(v) ? null : v;
};

const getStr = (node: Expression | undefined): string | null => {
  if (!node) return null;
  const m = node.getText().match(/^['"`](.*?)['"`]$/s);
  return m?.[1] ?? null;
};

const tryParse = (text: string): unknown => {
  try { return JSON.parse(text); } catch { return text.replace(/['"]/g, ""); }
};

// Detect which local identifier is used as the Joi namespace by scanning imports
const detectJoiId = (sourceFile: SourceFile): string | null => {
  for (const decl of sourceFile.getImportDeclarations()) {
    const mod = decl.getModuleSpecifierValue();
    if (mod !== "joi" && mod !== "@hapi/joi") continue;

    // import Joi from 'joi'  or  import * as Joi from 'joi'
    const def = decl.getDefaultImport() ?? decl.getNamespaceImport();
    if (def) return def.getText();
  }
  return null;
};

const isJoiExpr = (text: string, joiId: string): boolean =>
  new RegExp(`^${joiId}\\.(?:${[...JOI_PRIMITIVES].join("|")})\\s*\\(`).test(text);

export const extractJoiSchemas = (sourceFile: SourceFile): Record<string, JsonSchema> => {
  const schemas: Record<string, JsonSchema> = {};
  const joiId = detectJoiId(sourceFile);
  if (!joiId) return schemas;

  for (const decl of sourceFile.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init) continue;
    if (!isJoiExpr(init.getText(), joiId)) continue;

    try {
      const schema = joiNodeToJsonSchema(init, joiId);
      if (Object.keys(schema).length > 0) schemas[decl.getName()] = schema;
    } catch {
      // skip
    }
  }

  return schemas;
};
