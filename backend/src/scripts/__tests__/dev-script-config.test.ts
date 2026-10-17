import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assertDevScriptEnvironment, assertLocalDatabaseUrl, requireDevPassword } from '../dev-script-config';

describe('local dev script boundaries', () => {
  it('does not require dev passwords for ordinary environment validation', () => {
    expect(() => assertDevScriptEnvironment({})).not.toThrow();
    expect(() => assertDevScriptEnvironment({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertDevScriptEnvironment({ NODE_ENV: 'test' })).not.toThrow();
    expect(() => assertDevScriptEnvironment({ NODE_ENV: 'production' })).toThrow('cannot run in production');
  });

  it.each(['DEV_FIXTURE_PASSWORD', 'DEV_POSTGRES_PASSWORD'] as const)('requires %s only when the tool asks for it', (name) => {
    expect(() => requireDevPassword(name, {})).toThrow(name);
    expect(() => requireDevPassword(name, { [name]: '   ' })).toThrow(name);
    const password = randomBytes(24).toString('base64url');
    expect(requireDevPassword(name, { [name]: password })).toBe(password);
  });

  it.each(['localhost', '127.0.0.1', '[::1]'])('accepts the parsed loopback hostname %s', (host) => {
    expect(() => assertLocalDatabaseUrl(`postgresql://${host}:5433/local_test`)).not.toThrow();
  });

  it.each([
    undefined, '', 'not-a-url', 'https://localhost/test',
    'postgresql://remote.example/test', 'postgresql://localhost.evil.example/test',
    'postgresql://remote.example/test?redirect=@localhost:5433/test',
  ])('rejects invalid, remote or misleading URLs without leaking them', (value) => {
    expect(() => assertLocalDatabaseUrl(value)).toThrow(/local/);
    try { assertLocalDatabaseUrl(value); } catch (error) {
      expect(String(error)).not.toContain('masked');
      expect(String(error)).not.toContain('remote.example');
    }
  });
});
