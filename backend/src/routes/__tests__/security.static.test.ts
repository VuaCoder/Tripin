import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Source scans for rules that are cheap to break by accident. Run without a database.
const srcRoot = path.resolve(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'test') walk(full, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const files = walk(srcRoot);
const rel = (file: string) => path.relative(srcRoot, file).replace(/\\/g, '/');
const read = (file: string) => readFileSync(file, 'utf-8');

describe('security source rules', () => {
  it('only the logger (and CLI scripts) write to the console', () => {
    const offenders = files
      .filter((file) => !rel(file).startsWith('scripts/') && rel(file) !== 'utils/logger.ts')
      .filter((file) => /\bconsole\.(log|info|warn|error|debug)\b/.test(read(file)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('request bodies, headers and secrets are never passed to the logger', () => {
    const risky = /logger\.\w+\([^)]*(req\.body|req\.headers|req\.cookies|\bpassword\b|passwordHash|accessToken|refreshToken|JWT_|API_KEY|CHECKSUM|SMTP_PASSWORD)/;
    const offenders = files.filter((file) => risky.test(read(file))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('mappers (the only code that shapes responses) never mention credential fields', () => {
    const offenders = files
      .filter((file) => file.endsWith('.mapper.ts') && rel(file) !== 'modules/auth/auth.mapper.ts') // auth's mapper sets the HttpOnly refresh cookie; the JSON shape is covered over HTTP
      .filter((file) => /passwordHash|tokenHash|codeHash|checksum|refreshToken/i.test(read(file)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('credential columns are excluded from queries by default', () => {
    expect(read(path.join(srcRoot, 'modules/users/users.model.ts'))).toMatch(/passwordHash:\s*\{[^}]*select:\s*false/);
  });

  it('every JWT verification pins the algorithm and the issuer', () => {
    const verifies = files.filter((file) => /jwt\.verify\(/.test(read(file)));
    expect(verifies.length).toBeGreaterThan(0);
    for (const file of verifies) {
      const text = read(file);
      expect(text, rel(file)).toMatch(/algorithms:\s*\['HS256'\]/);
      expect(text, rel(file)).toMatch(/issuer:/);
    }
    expect(files.filter((file) => /jwt\.decode\(/.test(read(file))).map(rel)).toEqual([]); // decode() does not verify
  });

  it('no dynamic code execution or shell access in the API', () => {
    const offenders = files
      .filter((file) => !rel(file).startsWith('scripts/'))
      .filter((file) => /\beval\(|new Function\(|child_process|\bexecSync\(|\$where/.test(read(file)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('secrets are only read through config/env.ts', () => {
    const offenders = files
      .filter((file) => rel(file) !== 'config/env.ts' && rel(file) !== 'scripts/print-routes.ts') // the docs generator only SETS throw-away placeholders
      .filter((file) => /process\.env\.(JWT_|PAYOS_|AI_API_KEY|SMTP_|GOOGLE_CLIENT_SECRET)/.test(read(file)))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
