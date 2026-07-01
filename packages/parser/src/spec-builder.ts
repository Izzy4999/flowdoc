import type { FlowDocConfig, FlowDocSpec, ApiGroup, RouteDoc } from "@flowdoc/core";

/**
 * Groups extracted routes into named API groups and assembles the final FlowDocSpec.
 */
export const buildSpec = (
  routes: RouteDoc[],
  config: FlowDocConfig
): FlowDocSpec => {
  const filteredRoutes =
    config.exclude && config.exclude.length > 0
      ? routes.filter((r) => !config.exclude!.some((pattern) => matchesGlob(r.path, pattern)))
      : routes;

  const groups = groupRoutes(filteredRoutes, config.groups);

  return {
    info: {
      title: config.name,
      version: config.version ?? "1.0.0",
      baseUrl: config.baseUrl ?? "http://localhost:3000",
      ...(config.description !== undefined ? { description: config.description } : {}),
    },
    ...(config.auth !== undefined ? { auth: config.auth } : {}),
    groups,
    generatedAt: new Date().toISOString(),
    sourceFramework: config.framework,
  };
};

const groupRoutes = (
  routes: RouteDoc[],
  groupConfig?: Record<string, string[]>
): ApiGroup[] => {
  if (!groupConfig) {
    return groupByTag(routes);
  }

  const groups: ApiGroup[] = [];
  const assignedRoutes = new Set<string>();

  for (const [groupName, patterns] of Object.entries(groupConfig)) {
    const matched = routes.filter((r) => {
      const key = `${r.method}:${r.path}`;
      if (assignedRoutes.has(key)) return false;
      const matches = patterns.some((pattern) => matchesGlob(r.path, pattern));
      if (matches) assignedRoutes.add(key);
      return matches;
    });

    if (matched.length > 0) {
      groups.push({ name: groupName, routes: matched });
    }
  }

  // Catch unassigned routes under "Other"
  const unassigned = routes.filter(
    (r) => !assignedRoutes.has(`${r.method}:${r.path}`)
  );
  if (unassigned.length > 0) {
    groups.push({ name: "Other", routes: unassigned });
  }

  return groups;
};

const groupByTag = (routes: RouteDoc[]): ApiGroup[] => {
  const tagMap = new Map<string, RouteDoc[]>();

  for (const route of routes) {
    const tag = route.tags[0] ?? "default";
    if (!tagMap.has(tag)) tagMap.set(tag, []);
    tagMap.get(tag)!.push(route);
  }

  return Array.from(tagMap.entries()).map(([name, groupRoutes]) => ({
    name: capitalize(name),
    routes: groupRoutes,
  }));
};

const matchesGlob = (path: string, pattern: string): boolean => {
  // /users/** matches /users and /users/anything
  // Single pass: each token in the pattern is classified exactly once,
  // so a converted token (e.g. ".*") can never be re-matched by a later rule.
  const regexStr = pattern.replace(
    /\/\*\*$|\*\*|\*|[.+^${}()|[\]\\]/g,
    (token) => {
      if (token === "/**") return "(/.*)?";
      if (token === "**") return ".*";
      if (token === "*") return "[^/]*";
      return `\\${token}`;
    },
  );
  return new RegExp(`^${regexStr}$`).test(path);
};

const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);
