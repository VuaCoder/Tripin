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

/** Read only actual code arguments, never status strings inside messages or nearby statements. */
function scanErrors(text: string, add: (code: string, status: number) => void) {
  for (const match of text.matchAll(/AppError\.(\w+)\(|new AppError\(/g)) {
    const args: string[] = [];
    let from = match.index! + match[0].length, depth = 0, quote = '';
    for (let i = from; i < text.length; i++) {
      const ch = text[i]!;
      if (quote) {
        if (ch === '\\') { i++; continue; }
        if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '/' && text[i+1] === '/') { i = text.indexOf('\n', i); if (i < 0) break; continue; }
      if (ch === '/' && text[i+1] === '*') { i = text.indexOf('*/', i+2); if (i < 0) break; i++; continue; }
      if (ch === ')' && depth === 0) { args.push(text.slice(from,i).trim()); break; }
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (ch === ',' && depth === 0) { args.push(text.slice(from,i).trim()); from = i+1; }
    }
    const helper = match[1];
    const status = helper ? STATUS_OF_HELPER[helper] : Number(args[0]);
    if (!status) continue;
    // Some legacy badRequest callers expose their diagnostic identifier as
    // a literal details string. Keep these documented alongside true codes.
    const codeArg = helper === 'badRequest' ? args[2] || (/^['"][A-Z][A-Z0-9_]+['"]$/.test(args[1] ?? '') ? args[1] : undefined) : args[1];
    if (!codeArg) continue;
    for (const code of codeArg.matchAll(/['"]([A-Z][A-Z0-9_]+)['"]|ERROR_CODES\.([A-Z_]+)/g)) add(code[1] ?? code[2]!,status);
  }
}

/** code -> HTTP statuses it is thrown with, found in AppError calls and constructors. */
function codesInSource(): Map<string, Set<number>> {
  const found = new Map<string, Set<number>>();
  const add = (code: string, status: number) => found.set(code, (found.get(code) ?? new Set<number>()).add(status));
  for (const file of walk(srcRoot)) {
    const text = readFileSync(file, 'utf-8');
    if (text.includes('AppError')) scanErrors(text, add);
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
  it('distinguishes explicit error codes from business statuses and nested message expressions', () => {
    const found: [string, number][] = [];
    scanErrors("AppError.conflict(reasons.map(r => r === 'TEST_SOURCE' ? 'VERIFIED' : r).join('; ')); if (status === 'PROCESSING') work(); AppError.badRequest('bad', {status:'PENDING'}, 'SPECIFIC_ERROR'); new AppError(501, 'NOT_IMPLEMENTED', 'unsupported'); AppError.forbidden('no', ERROR_CODES.FORBIDDEN);", (code,status)=>found.push([code,status]));
    expect(found).toEqual([['SPECIFIC_ERROR',400],['NOT_IMPLEMENTED',501],['FORBIDDEN',403]]);
  });
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
