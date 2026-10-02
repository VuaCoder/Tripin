import type { RouteInfo } from '../routes/introspect';

const accessLabel = (route: RouteInfo): string =>
  route.access === 'public' ? 'public' : route.access === 'login' ? 'login' : route.access.map((p) => `\`${p}\``).join(', ');

/**
 * Renders docs/api/ENDPOINTS.md from the live route table. A test compares this output with the committed file, so the
 * document can never drift from the code (regenerate with `pnpm --filter backend docs:routes`).
 */
export function renderEndpointsMarkdown(routes: RouteInfo[]): string {
  const groups = new Map<string, RouteInfo[]>();
  for (const route of routes) {
    const key = route.mount || '/health';
    groups.set(key, [...(groups.get(key) ?? []), route]);
  }

  const lines = [
    '# API endpoint index',
    '',
    '> **Generated** from the Express routers by `pnpm --filter backend docs:routes` — do not edit by hand.',
    '> A test (`routes.docs.test.ts`) fails when this file is out of date.',
    '',
    `Base URL: \`/api/v1\` · ${routes.length} endpoints · behaviour, request/response shapes and rules are documented in each module README (\`backend/src/modules/<name>/README.md\`).`,
    '',
    '**Access**: `public` = no login needed (GUEST) · `login` = any logged-in user (ownership checked in the service) · `` `permission` `` = the listed permission(s) are required (see `packages/constants/src/permissions.ts`).',
    '',
    'Responses use one envelope: `{ "success": true, "data": …, "meta"?: { page, limit, total, totalPages } }` or `{ "success": false, "error": { "code", "message", "details"? } }`.',
    '',
  ];
  for (const [mount, items] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## \`${mount}\``, '', '| Method | Path | Access |', '|---|---|---|');
    for (const route of items) lines.push(`| ${route.method} | \`${route.path}\` | ${accessLabel(route)} |`);
    lines.push('');
  }
  return lines.join('\n');
}
