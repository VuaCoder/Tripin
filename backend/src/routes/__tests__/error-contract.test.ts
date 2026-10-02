import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../../utils/app-error';

// docs/api/ERRORS.md is the contract for error codes. Source scan, no database.
const srcRoot = path.resolve(process.cwd(), 'src');
const repoRoot = path.resolve(process.cwd(), '..');

const STATUS_OF_HELPER: Record<string, number> = {
  badRequest: 400,
  unauthenticated: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  invalidTransition: 409,
  tooManyRequests: 429,
  unavailable: 503,
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'test') walk(full, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** code -> HTTP statuses it is thrown with, found in `AppError.<helper>(...)` statements. */
function codesInSource(): Map<string, Set<number>> {
  const found = new Map<string, Set<number>>();
  const add = (code: string, status: number) => found.set(code, (found.get(code) ?? new Set<number>()).add(status));
  for (const file of walk(srcRoot)) {
    const text = readFileSync(file, 'utf-8');
    for (const match of text.matchAll(/AppError\.(\w+)\(/g)) {
      const status = STATUS_OF_HELPER[match[1]!];
      if (!status) continue;
      // The arguments of this call: up to the matching end of the statement (bounded, good enough for these call shapes).
      const statement = text.slice(match.index, match.index! + 500).split(/;\s*\n|\n\s*\n/)[0]!;
      for (const code of statement.matchAll(/'([A-Z][A-Z0-9_]{3,})'|ERROR_CODES\.([A-Z_]+)/g)) add(code[1] ?? code[2]!, status);
    }
  }
  for (const code of Object.values(ERROR_CODES)) if (!found.has(code)) found.set(code, new Set());
  return found;
}

function documented(): Map<string, number> {
  const table = new Map<string, number>();
  const text = readFileSync(path.join(repoRoot, 'docs/api/ERRORS.md'), 'utf-8');
  for (const row of text.matchAll(/^\| `([A-Z][A-Z0-9_]+)` \| (\d{3}) \|/gm)) table.set(row[1]!, Number(row[2]));
  return table;
}

describe('error code contract (docs/api/ERRORS.md)', () => {
  const inSource = codesInSource();
  const inDocs = documented();

  it('every error code the API can answer with is documented', () => {
    expect([...inSource.keys()].filter((code) => !inDocs.has(code)).sort()).toEqual([]);
  });

  it('no documented code is stale', () => {
    expect([...inDocs.keys()].filter((code) => !inSource.has(code)).sort()).toEqual([]);
  });

  it('the documented HTTP status matches the status the code is thrown with', () => {
    const mismatches = [...inDocs]
      .filter(([code, status]) => {
        const used = inSource.get(code);
        if (!used || used.size === 0) return false; // INTERNAL_ERROR and other codes produced by the error handler itself
        return !used.has(status);
      })
      .map(([code, status]) => `${code}: docs ${status}, source ${[...inSource.get(code)!].join('/')}`);
    expect(mismatches).toEqual([]);
  });

  it('the error handler produces the statuses documented for its own codes', () => {
    expect(inDocs.get('INTERNAL_ERROR')).toBe(500);
    expect(inDocs.get('VALIDATION_ERROR')).toBe(400);
    expect(inDocs.get('RATE_LIMITED')).toBe(429);
  });

  it('docs/api/README.md points to the table', () => {
    expect(readFileSync(path.join(repoRoot, 'docs/api/README.md'), 'utf-8')).toContain('ERRORS.md');
  });
});
