import { useState } from "react";
import type { RouteDoc } from "../types/spec.js";
import { generateExample } from "../lib/schema-utils.js";

interface PlaygroundProps {
  route: RouteDoc;
  baseUrl: string;
  auth?: { type: string; headerName?: string };
}

interface ResponseState {
  status: number;
  body: string;
  time: number;
}

export const Playground = ({ route, baseUrl, auth }: PlaygroundProps): JSX.Element => {
  const bodySchema =
    route.requestBody?.content?.["application/json"]?.schema ?? null;

  const hasBody = ["POST", "PUT", "PATCH"].includes(route.method);
  const defaultBody = bodySchema
    ? JSON.stringify(generateExample(bodySchema), null, 2)
    : hasBody
    ? "{}"
    : "";

  const [token, setToken] = useState("");
  const [body, setBody] = useState(defaultBody);
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pathParams = route.parameters.filter((p) => p.in === "path");
  const queryParams = route.parameters.filter((p) => p.in === "query");

  const buildUrl = (): string => {
    let path = route.path;
    for (const [k, v] of Object.entries(pathValues)) {
      path = path.replace(`:${k}`, encodeURIComponent(v));
    }
    const query = new URLSearchParams(
      Object.entries(queryValues).filter(([, v]) => v !== "")
    ).toString();
    return `${baseUrl}${path}${query ? `?${query}` : ""}`;
  };

  const send = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setResponse(null);
    const start = Date.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token && auth) {
        const headerName = auth.headerName ?? "Authorization";
        headers[headerName] =
          auth.type === "bearer" ? `Bearer ${token}` : token;
      }

      const res = await fetch(buildUrl(), {
        method: route.method,
        headers,
        body:
          ["POST", "PUT", "PATCH"].includes(route.method) && body
            ? body
            : undefined,
      });

      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // not JSON — display raw
      }

      setResponse({ status: res.status, body: pretty, time: Date.now() - start });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Auth */}
      {auth && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {auth.type === "bearer" ? "Bearer Token" : "API Key"}
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={auth.type === "bearer" ? "eyJ..." : "sk-..."}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[var(--brand)] transition-colors"
          />
        </div>
      )}

      {/* Path params */}
      {pathParams.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Path Parameters
          </label>
          {pathParams.map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-400 w-24 shrink-0">{p.name}</span>
              <input
                value={pathValues[p.name] ?? ""}
                onChange={(e) =>
                  setPathValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                }
                placeholder={String(p.schema.example ?? p.name)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>
          ))}
        </div>
      )}

      {/* Query params */}
      {queryParams.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Query Parameters
          </label>
          {queryParams.map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-400 w-24 shrink-0">{p.name}</span>
              <input
                value={queryValues[p.name] ?? ""}
                onChange={(e) =>
                  setQueryValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                }
                placeholder={p.required ? "required" : "optional"}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      {["POST", "PUT", "PATCH"].includes(route.method) && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Request Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[var(--brand)] transition-colors resize-y"
          />
        </div>
      )}

      {/* Send */}
      <button
        onClick={() => void send()}
        disabled={loading}
        className="self-start px-5 py-2 rounded-lg text-sm font-semibold bg-[var(--brand)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? "Sending…" : `Send ${route.method}`}
      </button>

      {/* Response */}
      {error && (
        <div className="bg-red-950/40 border border-red-900/50 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {response && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span
              className={`font-mono text-sm font-bold ${
                response.status >= 400 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {response.status}
            </span>
            <span className="text-xs text-slate-500">{response.time}ms</span>
          </div>
          <pre className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-auto max-h-96 whitespace-pre-wrap">
            {response.body}
          </pre>
        </div>
      )}
    </div>
  );
};
