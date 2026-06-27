import { useState } from "react";
import type { RouteDoc } from "./types/spec.js";
import { useSpec } from "./hooks/use-spec.js";
import { Sidebar } from "./components/Sidebar.js";
import { RouteDetail } from "./components/RouteDetail.js";

export const App = (): JSX.Element => {
  const { spec, loading, error } = useSpec();
  const [selectedRoute, setSelectedRoute] = useState<RouteDoc | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-400 text-sm">
        Loading docs…
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center space-y-2">
          <p className="text-red-400 text-sm font-medium">Failed to load flowdoc.json</p>
          <p className="text-slate-600 text-xs">{error}</p>
          <p className="text-slate-600 text-xs">Run <code className="text-[var(--brand)]">flowdoc generate</code> first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <Sidebar spec={spec} selectedRoute={selectedRoute} onSelect={setSelectedRoute} />

      <main className="flex-1 overflow-y-auto">
        {selectedRoute ? (
          <div className="max-w-3xl mx-auto px-8 py-10">
            <RouteDetail
              route={selectedRoute}
              baseUrl={spec.info.baseUrl}
              auth={spec.auth}
            />
          </div>
        ) : (
          <EmptyState title={spec.info.title} routeCount={spec.groups.reduce((a, g) => a + g.routes.length, 0)} />
        )}
      </main>
    </div>
  );
};

const EmptyState = ({ title, routeCount }: { title: string; routeCount: number }): JSX.Element => (
  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
    <div className="w-12 h-12 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center">
      <span className="text-[var(--brand)] text-xl font-bold">//</span>
    </div>
    <div className="space-y-1">
      <h1 className="text-lg font-semibold text-slate-200">{title}</h1>
      <p className="text-sm text-slate-500">
        {routeCount} route{routeCount !== 1 ? "s" : ""} documented
      </p>
    </div>
    <p className="text-xs text-slate-600 max-w-xs">
      Select a route from the sidebar to view its schema, parameters, and test it live.
    </p>
  </div>
);
