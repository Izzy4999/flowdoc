import { Node, SourceFile, type CallExpression, type Expression } from "ts-morph";
import type { JsonSchema } from "@flowdoc/core";

// Yup identifiers that signal a yup schema root
// Covers: `import * as yup from 'yup'` → yup.string()
//         `import { string, object } from 'yup'` → string()
const YUP_ROOT_METHODS = new Set([
  "string", "number", "boolean", "object", "array", "date", "mixed",
  "ref", "lazy",
]);

export const yupNodeToJsonSchema = (node: Expression): JsonSchema => {
  if (!Node.isCallExpression(node)) return {};

  const chain = unwrapYupChain(node);
  if (!chain.root) return {};

  const base = buildYupBase(chain.rootMethod);
  applyYupChain(chain.methods, base);
  return base;
};

interface YupChain {
  root: Expression | null;
  rootMethod: string;
  methods: Array<{ name: string; args: Expression[] }>;
}

const unwrapYupChain = (node: Expression): YupChain => {
  const methods: YupChain["methods"] = [];
  let current: Expression = node;

  while (Node.isCallExpression(current)) {
    const expr = current.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) {
      // Bare call: string(), object(), etc. — only if it's a yup primitive
      if (Node.isIdentifier(expr) && YUP_ROOT_METHODS.has(expr.getText())) {
        return { root: current, rootMethod: expr.getText(), methods };
      }
      return { root: null, rootMethod: "", methods };
    }

    const obj = expr.getExpression();
    const methodName = expr.getName();

    // yup.string() — namespace import root
    if (Node.isIdentifier(obj) && obj.getText() === "yup" && YUP_ROOT_METHODS.has(methodName)) {
      return { root: current, rootMethod: methodName, methods };
    }

    // Chain link: push and keep walking
    methods.unshift({ name: methodName, args: current.getArguments() as Expression[] });
    current = obj as Expression;
  }

  return { root: null, rootMethod: "", methods };
};

const buildYupBase = (method: string): JsonSchema => {
  switch (method) {
    case "string": return { type: "string" };
    case "number": return { type: "number" };
    case "boolean": return { type: "boolean" };
    case "date": return { type: "string", format: "date-time" };
    case "array": return { type: "array" };
    case "object": return { type: "object" };
    default: return {};
  }
};

const applyYupChain = (
  methods: Array<{ name: string; args: Expression[] }>,
  schema: JsonSchema
): void => {
  let required = false;

  for (const { name, args } of methods) {
    switch (name) {
      case "required":
        required = true;
        break;
      case "optional":
      case "nullable":
        schema.nullable = true;
        break;
      case "email":
        schema.format = "email";
        break;
      case "url":
        schema.format = "uri";
        break;
      case "uuid":
        schema.format = "uuid";
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
      case "oneOf": {
        const arg = args[0];
        if (arg && Node.isArrayLiteralExpression(arg)) {
          schema.enum = arg.getElements().map((el) => el.getText().replace(/['"]/g, ""));
        }
        break;
      }
      case "shape": {
        // yup.object().shape({ field: yup.string() })
        const arg = args[0];
        if (arg && Node.isObjectLiteralExpression(arg)) {
          const { properties, required: req } = parseYupShape(arg);
          schema.type = "object";
          schema.properties = properties;
          if (req.length > 0) schema.required = req;
        }
        break;
      }
      case "of": {
        // yup.array().of(yup.string())
        const arg = args[0] as Expression | undefined;
        if (arg) schema.items = yupNodeToJsonSchema(arg);
        break;
      }
      case "label": {
        const s = getStr(args[0]);
        if (s) schema.title = s;
        break;
      }
      case "meta": {
        // meta({ description: '...' })
        const arg = args[0];
        if (arg && Node.isObjectLiteralExpression(arg)) {
          for (const prop of arg.getProperties()) {
            if (Node.isPropertyAssignment(prop) && prop.getName() === "description") {
              const s = getStr(prop.getInitializer());
              if (s) schema.description = s;
            }
          }
        }
        break;
      }
      case "default": {
        const arg = args[0];
        if (arg) schema.default = tryParse(arg.getText());
        break;
      }
    }
  }

  // Mark required as a side-channel (used by object shape parser)
  if (required) (schema as JsonSchema & { __required?: boolean }).__required = true;
};

const parseYupShape = (
  arg: ReturnType<Expression["asKind"]>
): { properties: Record<string, JsonSchema>; required: string[] } => {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  if (!arg || !Node.isObjectLiteralExpression(arg)) return { properties, required };

  for (const prop of arg.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getName();
    const init = prop.getInitializer();
    if (!init) continue;

    const childSchema = yupNodeToJsonSchema(init);
    // Extract the __required side-channel
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

const isYupExpr = (text: string): boolean =>
  /^yup\.(?:string|number|boolean|object|array|date|mixed)\s*\(/.test(text) ||
  /^(?:string|number|boolean|object|array|date|mixed)\s*\(\s*\)/.test(text);

export const extractYupSchemas = (sourceFile: SourceFile): Record<string, JsonSchema> => {
  const schemas: Record<string, JsonSchema> = {};

  for (const decl of sourceFile.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init) continue;
    const text = init.getText();
    if (!isYupExpr(text)) continue;

    try {
      const schema = yupNodeToJsonSchema(init);
      if (Object.keys(schema).length > 0) schemas[decl.getName()] = schema;
    } catch {
      // skip
    }
  }

  return schemas;
};
