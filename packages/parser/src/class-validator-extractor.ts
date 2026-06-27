import { Node, SourceFile, SyntaxKind } from "ts-morph";
import type { JsonSchema } from "@flowdoc/core";

// class-validator decorator → JsonSchema fragment it contributes
const DECORATOR_MAP: Record<string, Partial<JsonSchema>> = {
  IsString:     { type: "string" },
  IsNumber:     { type: "number" },
  IsInt:        { type: "integer" },
  IsBoolean:    { type: "boolean" },
  IsDate:       { type: "string", format: "date-time" },
  IsDateString: { type: "string", format: "date-time" },
  IsEmail:      { type: "string", format: "email" },
  IsUrl:        { type: "string", format: "uri" },
  IsUUID:       { type: "string", format: "uuid" },
  IsArray:      { type: "array" },
  IsObject:     { type: "object" },
  IsHexColor:   { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
  IsIP:         { type: "string", format: "ipv4" },
  IsJWT:        { type: "string", format: "jwt" },
  IsPhoneNumber:{ type: "string" },
  IsPostalCode: { type: "string" },
};

// Decorators whose first argument is a constraint value (number or string)
const CONSTRAINED: Record<string, (schema: JsonSchema, val: unknown) => void> = {
  MinLength:   (s, v) => { s.type = s.type ?? "string"; s.minLength = Number(v); },
  MaxLength:   (s, v) => { s.type = s.type ?? "string"; s.maxLength = Number(v); },
  Min:         (s, v) => { s.minimum = Number(v); },
  Max:         (s, v) => { s.maximum = Number(v); },
  ArrayMinSize:(s, v) => { s.minItems = Number(v); },
  ArrayMaxSize:(s, v) => { s.maxItems = Number(v); },
  Length:      (s, v) => { s.minLength = Number(v); s.maxLength = Number(v); },
  Matches:     (s, v) => {
    const pat = String(v).replace(/^\/|\/[gimsuy]*$/g, "");
    s.pattern = pat;
  },
  IsIn:        (s, v) => {
    if (Array.isArray(v)) s.enum = v.map(String);
  },
  IsEnum:      (s, _v) => {
    // Can't statically resolve the enum object value easily without type resolution;
    // leave type as-is and note string.
    s.type = s.type ?? "string";
  },
};

// Whether the property is optional in the schema
const OPTIONAL_DECORATORS = new Set(["IsOptional"]);

/**
 * Scans a source file for classes decorated with class-validator decorators.
 * Returns a map of ClassName → JsonSchema (type: "object") describing the DTO shape.
 */
export const extractClassValidatorSchemas = (sourceFile: SourceFile): Record<string, JsonSchema> => {
  const schemas: Record<string, JsonSchema> = {};

  // Only process files that actually import from class-validator
  const hasClassValidator = sourceFile.getImportDeclarations().some((d) => {
    const mod = d.getModuleSpecifierValue();
    return mod === "class-validator" || mod.includes("class-validator");
  });
  if (!hasClassValidator) return schemas;

  for (const cls of sourceFile.getClasses()) {
    const className = cls.getName();
    if (!className) continue;

    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const prop of cls.getProperties()) {
      const decorators = prop.getDecorators();
      if (decorators.length === 0) continue;

      const propSchema: JsonSchema = {};
      let isOptional = false;

      for (const decorator of decorators) {
        const name = decorator.getName();

        // Type decorators
        if (DECORATOR_MAP[name]) {
          Object.assign(propSchema, DECORATOR_MAP[name]);
          continue;
        }

        // Constrained decorators (first arg is the value)
        if (CONSTRAINED[name]) {
          const call = decorator.getCallExpression();
          const firstArg = call?.getArguments()[0];
          if (firstArg) {
            const raw = firstArg.getText();
            // Try to resolve array literal or number
            if (Node.isArrayLiteralExpression(firstArg)) {
              const values = firstArg.getElements().map((el) => el.getText().replace(/['"]/g, ""));
              CONSTRAINED[name]!(propSchema, values);
            } else {
              const num = Number(raw);
              CONSTRAINED[name]!(propSchema, isNaN(num) ? raw.replace(/['"]/g, "") : num);
            }
          }
          continue;
        }

        if (OPTIONAL_DECORATORS.has(name)) {
          isOptional = true;
          continue;
        }

        // @ValidateNested() — nested DTO, leave as object and rely on @Type
        if (name === "ValidateNested") {
          propSchema.type = "object";
          continue;
        }
      }

      // Infer type from TypeScript property type if no decorator set it
      if (!propSchema.type) {
        const typeNode = prop.getTypeNode();
        if (typeNode) {
          const typeText = typeNode.getText();
          if (typeText === "string") propSchema.type = "string";
          else if (typeText === "number") propSchema.type = "number";
          else if (typeText === "boolean") propSchema.type = "boolean";
          else if (typeText.endsWith("[]")) propSchema.type = "array";
        }
      }

      if (Object.keys(propSchema).length === 0) continue;

      const propName = prop.getName();
      properties[propName] = propSchema;
      if (!isOptional) required.push(propName);
    }

    if (Object.keys(properties).length === 0) continue;

    schemas[className] = {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  return schemas;
};
