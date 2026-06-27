import type { FlowDocConfig } from "@flowdoc/core";

const config: FlowDocConfig = {
  name: "Example API",
  version: "1.0.0",
  description: "Demo Express API documented by flowdoc",
  framework: "express",
  entry: "./src",
  baseUrl: "http://localhost:3000",
  auth: { type: "bearer" },
  output: "./docs-output",
  theme: { brand: "#6366f1", darkMode: true },
  groups: {
    "Auth": ["/auth/**"],
    "Users": ["/users/**"],
  },
};

export default config;
