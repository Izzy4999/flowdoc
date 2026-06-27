import type { JsonSchema } from "../types/spec.js";

export const generateExample = (schema: JsonSchema): unknown => {
  if (schema.example !== undefined) return schema.example;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case "string":
      if (schema.format === "email") return "user@example.com";
      if (schema.format === "date-time") return new Date().toISOString();
      if (schema.format === "uuid") return "550e8400-e29b-41d4-a716-446655440000";
      if (schema.format === "uri") return "https://example.com";
      return "string";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "array":
      return schema.items ? [generateExample(schema.items)] : [];
    case "object": {
      if (!schema.properties) return {};
      return Object.fromEntries(
        Object.entries(schema.properties).map(([k, v]) => [k, generateExample(v)])
      );
    }
    default:
      return null;
  }
};
