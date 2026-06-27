import type { HttpMethod } from "../types/spec.js";

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET:     "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  POST:    "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  PUT:     "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  PATCH:   "bg-orange-500/15 text-orange-400 ring-orange-500/20",
  DELETE:  "bg-red-500/15 text-red-400 ring-red-500/20",
  HEAD:    "bg-purple-500/15 text-purple-400 ring-purple-500/20",
  OPTIONS: "bg-slate-500/15 text-slate-400 ring-slate-500/20",
};

interface MethodBadgeProps {
  method: HttpMethod;
  size?: "sm" | "md";
}

export const MethodBadge = ({ method, size = "md" }: MethodBadgeProps): JSX.Element => {
  const styles = METHOD_STYLES[method] ?? METHOD_STYLES.GET;
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5 min-w-[42px]" : "text-xs px-2 py-1 min-w-[52px]";

  return (
    <span
      className={`inline-flex items-center justify-center font-mono font-semibold rounded ring-1 ring-inset tracking-wider ${styles} ${sizeClass}`}
    >
      {method}
    </span>
  );
};
