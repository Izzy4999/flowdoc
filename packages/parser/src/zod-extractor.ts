import { Node, SourceFile, SyntaxKind, type CallExpression, type Expression } from "ts-morph";
import type { JsonSchema } from "@flowdoc/core";

interface ZodSchemaMap {
  [name: string]: JsonSchema;
}

/**
 * Converts a Zod call expression AST node into a JsonSchema descriptor.
 * Handles the most common Zod primitives and composites used in Express apps.
 */
export const zodNodeToJsonSchema = (node: Expression): JsonSchema => {
  if (!Node.isCallExpression(node)) return {};

  const expr = node.getExpression();
  const callText = expr.getText();

  // z.string(), z.number(), etc.
  if (callText === "z.string") return buildStringSchema(node);
  if (callText === "z.number") return buildNumberSchema(node);
  if (callText === "z.boolean") return { type: "boolean" };
  if (callText === "z.null") return { type: "null" };
  if (callText === "z.literal") return buildLiteralSchema(node);
  if (callText === "z.enum") return buildEnumSchema(node);
  if (callText === "z.nativeEnum") return { type: "string" };
  if (callText === "z.object") return buildObjectSchema(node);
  if (callText === "z.array") return buildArraySchema(node);
  if (callText === "z.union") return buildUnionSchema(node);
  if (callText === "z.optional") return buildOptionalSchema(node);
  if (callText === "z.date") return { type: "string", format: "date-time" };
  if (callText === "z.any") return {};
  if (callText === "z.unknown") return {};

  // Chained: z.string().email().min(3) — the outer is a chain
  if (Node.isPropertyAccessExpression(expr)) {
    return buildChainedSchema(node);
  }

  return {};
};

const buildStringSchema = (node: CallExpression): JsonSchema => {
  const schema: JsonSchema = { type: "string" };
  applyChainedValidations(node, schema);
  return schema;
};

const buildNumberSchema = (node: CallExpression): JsonSchema => {
  const schema: JsonSchema = { type: "number" };
  applyChainedValidations(node, schema);
  return schema;
};

const buildLiteralSchema = (node: CallExpression): JsonSchema => {
  const arg = node.getArguments()[0];
  if (!arg) return {};
  const text = arg.getText().replace(/['"]/g, "");
  return { type: "string", enum: [text] };
};

const buildEnumSchema = (node: CallExpression): JsonSchema => {
  const arg = node.getArguments()[0];
  if (!arg || !Node.isArrayLiteralExpression(arg)) return { type: "string" };
  const values = arg.getElements().map((el) => el.getText().replace(/['"]/g, ""));
  return { type: "string", enum: values };
};

const buildObjectSchema = (node: CallExpression): JsonSchema => {
  const arg = node.getArguments()[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) return { type: "object" };

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const prop of arg.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getName();
    const init = prop.getInitializer();
    if (!init) continue;

    const childSchema = zodNodeToJsonSchema(init);
    properties[name] = childSchema;

    // A field is required unless explicitly .optional() or .nullish()
    if (!isOptionalZodExpr(init)) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
};

const buildArraySchema = (node: CallExpression): JsonSchema => {
  const arg = node.getArguments()[0] as Expression | undefined;
  if (!arg) return { type: "array" };
  return { type: "array", items: zodNodeToJsonSchema(arg) };
};

const buildUnionSchema = (node: CallExpression): JsonSchema => {
  const arg = node.getArguments()[0];
  if (!arg || !Node.isArrayLiteralExpression(arg)) return {};
  const schemas = arg.getElements().map((el) => zodNodeToJsonSchema(el as Expression));
  return { anyOf: schemas };
};

const buildOptionalSchema = (node: CallExpression): JsonSchema => {
  const arg = node.getArguments()[0] as Expression | undefined;
  if (!arg) return {};
  return zodNodeToJsonSchema(arg);
};

/**
 * Handles chained calls like z.string().email().min(3).describe("...")
 */
const buildChainedSchema = (node: CallExpression): JsonSchema => {
  // Walk the chain to find the root z.xxx() call
  const chain = unwrapChain(node);
  if (!chain.root) return {};

  const base = zodNodeToJsonSchema(chain.root);
  applyChainedCallsToSchema(chain.methods, base);
  return base;
};

interface ChainInfo {
  root: Expression | null;
  methods: Array<{ name: string; args: Expression[] }>;
}

const unwrapChain = (node: Expression): ChainInfo => {
  const methods: ChainInfo["methods"] = [];
  let current: Expression = node;

  while (Node.isCallExpression(current)) {
    const expr = current.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const obj = expr.getExpression();
      // If the callee object is a plain identifier (z), current IS the root z.xxx() call
      if (Node.isIdentifier(obj)) {
        return { root: current, methods };
      }
      const methodName = expr.getName();
      const args = current.getArguments() as Expression[];
      methods.unshift({ name: methodName, args });
      current = obj as Expression;
    } else {
      return { root: current, methods };
    }
  }

  return { root: null, methods };
};

const applyChainedValidations = (node: CallExpression, schema: JsonSchema): void => {
  const chain = unwrapChain(node);
  applyChainedCallsToSchema(chain.methods, schema);
};

const applyChainedCallsToSchema = (
  methods: Array<{ name: string; args: Expression[] }>,
  schema: JsonSchema
): void => {
  for (const { name, args } of methods) {
    switch (name) {
      case "email":
        schema.format = "email";
        break;
      case "url":
        schema.format = "uri";
        break;
      case "uuid":
        schema.format = "uuid";
        break;
      case "datetime":
        schema.format = "date-time";
        break;
      case "min": {
        const val = getNumericArg(args[0]);
        if (val !== null) {
          if (schema.type === "string") schema.minLength = val;
          else schema.minimum = val;
        }
        break;
      }
      case "max": {
        const val = getNumericArg(args[0]);
        if (val !== null) {
          if (schema.type === "string") schema.maxLength = val;
          else schema.maximum = val;
        }
        break;
      }
      case "describe": {
        const desc = getStringArg(args[0]);
        if (desc) schema.description = desc;
        break;
      }
      case "default": {
        const arg = args[0];
        if (arg) schema.default = tryParseValue(arg.getText());
        break;
      }
      case "optional":
      case "nullish":
        // Mark nullable but keep type
        schema.nullable = true;
        break;
      case "positive":
        schema.minimum = 0;
        break;
      case "negative":
        schema.maximum = 0;
        break;
      case "int":
        schema.type = "integer";
        break;
      case "regex": {
        const pattern = args[0]?.getText();
        if (pattern) schema.pattern = pattern.replace(/^\/|\/[gimsuy]*$/g, "");
        break;
      }
    }
  }
};

const isOptionalZodExpr = (node: Expression): boolean => {
  const text = node.getText();
  return (
    text.includes(".optional()") ||
    text.includes(".nullish()") ||
    text.startsWith("z.optional(")
  );
};

const getNumericArg = (node: Expression | undefined): number | null => {
  if (!node) return null;
  const val = Number(node.getText());
  return isNaN(val) ? null : val;
};

const getStringArg = (node: Expression | undefined): string | null => {
  if (!node) return null;
  const text = node.getText();
  const match = text.match(/^['"`](.*?)['"`]$/s);
  return match?.[1] ?? null;
};

const tryParseValue = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text.replace(/['"]/g, "");
  }
};

/**
 * Scans a source file for exported Zod schema variable declarations.
 * Returns a map of variable name → JsonSchema.
 */
export const extractZodSchemas = (sourceFile: SourceFile): ZodSchemaMap => {
  const schemas: ZodSchemaMap = {};

  const varDeclarations = sourceFile.getVariableDeclarations();
  for (const decl of varDeclarations) {
    const init = decl.getInitializer();
    if (!init) continue;
    const text = init.getText();
    if (!text.startsWith("z.")) continue;

    const name = decl.getName();
    try {
      schemas[name] = zodNodeToJsonSchema(init);
    } catch {
      // Skip unparseable schemas silently
    }
  }

  return schemas;
};
