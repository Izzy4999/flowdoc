import type { JsonSchema } from "./types.js";

export const generateExample = (schema: JsonSchema): unknown => {
  if (schema.example !== undefined) return schema.example;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case "string":
      if (schema.format === "email") return "user@example.com";
      if (schema.format === "date-time") return new Date().toISOString();
      if (schema.format === "date") return new Date().toISOString().split("T")[0];
      if (schema.format === "uuid") return "550e8400-e29b-41d4-a716-446655440000";
      if (schema.format === "uri") return "https://example.com";
      return "string";
    case "number":
      return 0;
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "array":
      return schema.items ? [generateExample(schema.items)] : [];
    case "object": {
      if (!schema.properties) return {};
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        result[key] = generateExample(value);
      }
      return result;
    }
    default:
      return null;
  }
};

export const mergeSchemas = (base: JsonSchema, override: Partial<JsonSchema>): JsonSchema => ({
  ...base,
  ...override,
});

export const makeObjectSchema = (
  properties: Record<string, JsonSchema>,
  required: string[] = []
): JsonSchema => {
  const schema: JsonSchema = { type: "object", properties };
  if (required.length > 0) schema.required = required;
  return schema;
};

export const makeArraySchema = (items: JsonSchema): JsonSchema => ({
  type: "array",
  items,
});

export const primitiveSchema = (
  type: "string" | "number" | "integer" | "boolean",
  opts: Partial<JsonSchema> = {}
): JsonSchema => ({ type, ...opts });
