export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type ParameterLocation = "path" | "query" | "header" | "cookie";

export type SchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

export interface JsonSchema {
  type?: SchemaType | SchemaType[];
  format?: string;
  description?: string;
  example?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  title?: string;
  default?: unknown;
}

export interface RouteParameter {
  name: string;
  in: ParameterLocation;
  required: boolean;
  schema: JsonSchema;
  description?: string;
  example?: unknown;
}

export interface RequestBody {
  required: boolean;
  description?: string;
  content: {
    "application/json"?: { schema: JsonSchema };
    "multipart/form-data"?: { schema: JsonSchema };
    "application/x-www-form-urlencoded"?: { schema: JsonSchema };
  };
}

export interface ResponseBody {
  description: string;
  content?: {
    "application/json"?: { schema: JsonSchema };
  };
}

export interface RouteDoc {
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: RouteParameter[];
  requestBody?: RequestBody;
  responses: Record<string, ResponseBody>;
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
  middleware?: string[];
}

export interface ApiGroup {
  name: string;
  description?: string;
  routes: RouteDoc[];
}

export interface FlowDocSpec {
  info: {
    title: string;
    version: string;
    description?: string;
    baseUrl: string;
  };
  auth?: {
    type: "bearer" | "apiKey" | "basic" | "oauth2";
    headerName?: string;
    queryName?: string;
  };
  groups: ApiGroup[];
  generatedAt: string;
  sourceFramework: "express" | "nestjs";
}

export interface FlowDocConfig {
  name: string;
  version?: string;
  description?: string;
  framework: "express" | "nestjs";
  entry: string;
  baseUrl?: string;
  auth?: FlowDocSpec["auth"];
  output?: string;
  theme?: {
    brand?: string;
    logo?: string;
    darkMode?: boolean;
  };
  groups?: Record<string, string[]>;
  exclude?: string[];
}
