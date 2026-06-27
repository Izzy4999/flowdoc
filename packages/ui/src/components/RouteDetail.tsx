import { useState } from "react";
import type { RouteDoc } from "../types/spec.js";
import { MethodBadge } from "./MethodBadge.js";
import { SchemaViewer } from "./SchemaViewer.js";
import { Playground } from "./Playground.js";

interface RouteDetailProps {
  route: RouteDoc;
  baseUrl: string;
  auth?: { type: string; headerName?: string };
}

type Tab = "schema" | "playground";

export const RouteDetail = ({ route, baseUrl, auth }: RouteDetailProps): JSX.Element => {
  const [tab, setTab] = useState<Tab>("schema");

  const bodySchema =
    route.requestBody?.content?.["application/json"]?.schema ?? null;
  const pathParams = route.parameters.filter((p) => p.in === "path");
  const queryParams = route.parameters.filter((p) => p.in === "query");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <MethodBadge method={route.method} />
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-mono text-sm text-slate-100 break-all">{route.path}</span>
          {route.summary && (
            <p className="text-sm text-slate-400">{route.summary}</p>
          )}
        </div>
      </div>

      {route.description && (
        <p className="text-sm text-slate-400 leading-relaxed">{route.description}</p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {(["schema", "playground"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "text-slate-100 border-b-2 border-[var(--brand)] -mb-px"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "schema" && (
        <div className="flex flex-col gap-6">
          {/* Path params */}
          {pathParams.length > 0 && (
            <Section title="Path Parameters">
              <ParamTable params={pathParams} />
            </Section>
          )}

          {/* Query params */}
          {queryParams.length > 0 && (
            <Section title="Query Parameters">
              <ParamTable params={queryParams} />
            </Section>
          )}

          {/* Request body */}
          {bodySchema && (
            <Section title="Request Body">
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                <SchemaViewer schema={bodySchema} />
              </div>
            </Section>
          )}

          {/* Responses */}
          <Section title="Responses">
            <div className="flex flex-col gap-2">
              {Object.entries(route.responses).map(([code, resp]) => (
                <div
                  key={code}
                  className="flex items-start gap-3 bg-slate-900 rounded-lg border border-slate-800 p-3"
                >
                  <StatusCode code={code} />
                  <span className="text-sm text-slate-400">{resp.description}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === "playground" && (
        <Playground route={route} baseUrl={baseUrl} auth={auth} />
      )}
    </div>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element => (
  <div className="flex flex-col gap-3">
    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h3>
    {children}
  </div>
);

const ParamTable = ({
  params,
}: {
  params: RouteDoc["parameters"];
}): JSX.Element => (
  <div className="flex flex-col gap-2">
    {params.map((p) => (
      <div
        key={`${p.in}-${p.name}`}
        className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start bg-slate-900 border border-slate-800 rounded-lg p-3"
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs text-slate-200">{p.name}</span>
          {p.description && <span className="text-[11px] text-slate-500">{p.description}</span>}
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {p.required && (
            <span className="text-[10px] text-red-400 font-medium">required</span>
          )}
          <span className="font-mono text-[10px] text-slate-500">
            {String(p.schema.type ?? "any")}
          </span>
        </div>
        <div />
      </div>
    ))}
  </div>
);

const StatusCode = ({ code }: { code: string }): JSX.Element => {
  const n = parseInt(code, 10);
  const color =
    n >= 500 ? "text-red-400" :
    n >= 400 ? "text-amber-400" :
    n >= 300 ? "text-blue-400" :
    "text-emerald-400";
  return <span className={`font-mono text-sm font-semibold ${color} w-10 shrink-0`}>{code}</span>;
};
