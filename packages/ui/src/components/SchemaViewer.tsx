import type { JsonSchema } from "../types/spec.js";

interface SchemaViewerProps {
  schema: JsonSchema;
  depth?: number;
}

export const SchemaViewer = ({ schema, depth = 0 }: SchemaViewerProps): JSX.Element => {
  const indent = depth * 16;

  if (schema.anyOf) {
    return (
      <div style={{ marginLeft: indent }}>
        <span className="text-slate-400 text-xs">one of:</span>
        {schema.anyOf.map((s, i) => (
          <SchemaViewer key={i} schema={s} depth={depth + 1} />
        ))}
      </div>
    );
  }

  if (schema.enum) {
    return (
      <span style={{ marginLeft: indent }} className="text-amber-400 font-mono text-xs">
        {schema.enum.map((v) => JSON.stringify(v)).join(" | ")}
      </span>
    );
  }

  if (schema.type === "object" && schema.properties) {
    return (
      <div style={{ marginLeft: indent }} className="space-y-1">
        {Object.entries(schema.properties).map(([key, val]) => {
          const required = schema.required?.includes(key) ?? false;
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-200">{key}</span>
                {required && (
                  <span className="text-[10px] text-red-400 font-medium">required</span>
                )}
                <TypePill schema={val} />
              </div>
              {val.description && (
                <p className="text-xs text-slate-500 pl-0">{val.description}</p>
              )}
              {val.type === "object" && val.properties && (
                <div className="border-l border-slate-700 pl-3 mt-1">
                  <SchemaViewer schema={val} depth={0} />
                </div>
              )}
              {val.type === "array" && val.items && (
                <div className="border-l border-slate-700 pl-3 mt-1">
                  <span className="text-[10px] text-slate-500">items:</span>
                  <SchemaViewer schema={val.items} depth={0} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (schema.type === "array" && schema.items) {
    return (
      <div style={{ marginLeft: indent }}>
        <span className="text-xs text-slate-400">Array of:</span>
        <SchemaViewer schema={schema.items} depth={depth} />
      </div>
    );
  }

  return (
    <div style={{ marginLeft: indent }}>
      <TypePill schema={schema} />
      {schema.description && (
        <p className="text-xs text-slate-500 mt-0.5">{schema.description}</p>
      )}
    </div>
  );
};

const TypePill = ({ schema }: { schema: JsonSchema }): JSX.Element => {
  const type = Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type ?? "any";
  const format = schema.format ? ` (${schema.format})` : "";

  const colorMap: Record<string, string> = {
    string: "text-green-400",
    number: "text-blue-400",
    integer: "text-blue-400",
    boolean: "text-purple-400",
    object: "text-amber-400",
    array: "text-orange-400",
    null: "text-slate-500",
  };

  const color = colorMap[type] ?? "text-slate-400";

  return (
    <span className={`font-mono text-[11px] ${color}`}>
      {type}{format}
    </span>
  );
};
