import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENV_KEYS } from '../../config/env';
import { listRoutes } from '../../routes/introspect';
import { renderEndpointsMarkdown } from '../routes-doc';

// vitest runs with cwd = backend
const repoRoot = path.resolve(process.cwd(), '..');
const read = (relative: string) => readFileSync(path.join(repoRoot, relative), 'utf-8').replace(/\r\n/g, '\n');

describe('documentation stays in sync with the code', () => {
  it('docs/api/ENDPOINTS.md matches the live route table (run `pnpm --filter backend docs:routes` to refresh it)', () => {
    expect(read('docs/api/ENDPOINTS.md').trimEnd()).toBe(renderEndpointsMarkdown(listRoutes()).trimEnd());
  });

  it('.env.example documents every environment variable the API reads', () => {
    const documented = new Set(
      read('.env.example')
        .split('\n')
        .map((line) => /^([A-Z0-9_]+)=/.exec(line)?.[1])
        .filter((key): key is string => Boolean(key)),
    );
    const missing = ENV_KEYS.filter((key) => !documented.has(key));
    expect(missing).toEqual([]);
  });

  it('docs/backend/USE_CASE_MAP.md lists exactly the endpoints the API serves', () => {
    const normalize = (p: string) => p.split('?')[0]!.replace(/\/$/, '').replace(/:\w+/g, ':p');
    const served = new Set(
      [...read('docs/api/ENDPOINTS.md').matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) \| `\/api\/v1(\/[^`]*)`/gm)].map(
        (m) => `${m[1]} ${normalize(m[2]!)}`,
      ),
    );
    const mapped = new Set<string>();
    for (const [, code] of read('docs/backend/USE_CASE_MAP.md').matchAll(/`([^`]+)`/g)) {
      for (const part of code!.split(',')) {
        const m = /^((?:GET|POST|PUT|PATCH|DELETE)(?:\/(?:GET|POST|PUT|PATCH|DELETE))*) (\/\S*)/.exec(part.trim());
        if (m) for (const method of m[1]!.split('/')) mapped.add(`${method} ${normalize(m[2]!)}`);
      }
    }
    expect([...mapped].filter((e) => !served.has(e)).sort()).toEqual([]);
    expect([...served].filter((e) => !mapped.has(e)).sort()).toEqual([]);
  });

  it('every module folder has a README', () => {
    const modules = path.join(repoRoot, 'backend/src/modules');
    const { readdirSync, existsSync } = require('node:fs') as typeof import('node:fs');
    const missing = readdirSync(modules, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !existsSync(path.join(modules, name, 'README.md')));
    expect(missing).toEqual([]);
  });
});
