/** `pnpm --filter backend docs:routes` — writes docs/api/ENDPOINTS.md from the live route table. */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export const ENDPOINTS_DOC = path.resolve(process.cwd(), '../docs/api/ENDPOINTS.md');

async function main(): Promise<void> {
  // Building the route table needs no secrets, but loading the app validates the environment: give the two required
  // JWT variables throw-away values so the generator also works on a machine without a .env file.
  process.env.JWT_ACCESS_SECRET ??= 'docs-only-access-secret-not-used-for-anything';
  process.env.JWT_REFRESH_SECRET ??= 'docs-only-refresh-secret-not-used-for-anything';
  const { listRoutes } = await import('../routes/introspect');
  const { renderEndpointsMarkdown } = await import('./routes-doc');
  writeFileSync(ENDPOINTS_DOC, renderEndpointsMarkdown(listRoutes()), 'utf-8');
  console.log(`[docs] wrote ${ENDPOINTS_DOC}`);
}

void main();
