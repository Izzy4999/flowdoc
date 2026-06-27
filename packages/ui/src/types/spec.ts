export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface JsonSchema {
  type?: string | string[];
  format?: string;
  description?: string;
  example?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  anyOf?: JsonSchema[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
}

export interface RouteParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
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
  };
}

export interface ResponseBody {
  description: string;
  content?: { "application/json"?: { schema: JsonSchema } };
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
  sourceFramework: string;
}
