import { useState, useEffect } from "react";
import type { FlowDocSpec } from "../types/spec.js";

interface UseSpecResult {
  spec: FlowDocSpec | null;
  loading: boolean;
  error: string | null;
}

export const useSpec = (): UseSpecResult => {
  const [spec, setSpec] = useState<FlowDocSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const docsBase = (window as unknown as Record<string, string>)["__FLOWDOC_DOCS_BASE__"] ?? "";
    fetch(`${docsBase}/flowdoc.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FlowDocSpec>;
      })
      .then((data) => {
        // When served via the Express middleware, the server injects the live
        // baseUrl into the window so the Playground hits the right host.
        const liveBase = (window as unknown as Record<string, string>)["__FLOWDOC_BASE_URL__"];
        if (liveBase) data.info.baseUrl = liveBase;
        setSpec(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load spec");
        setLoading(false);
      });
  }, []);

  return { spec, loading, error };
};
