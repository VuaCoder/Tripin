import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  embedded: vi.fn(), client: vi.fn(),
  initialise: vi.fn(async () => undefined), start: vi.fn(async () => undefined),
  stop: vi.fn(async () => undefined), createDatabase: vi.fn(async () => undefined),
  connect: vi.fn(async () => undefined), query: vi.fn(async () => undefined), end: vi.fn(async () => undefined),
}));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));
vi.mock('node:fs', () => ({
  mkdtempSync: () => path.join(os.tmpdir(), 'tripri-dev-pg-unit-only'),
  readdirSync: () => [], readFileSync: () => '', rmSync: vi.fn(),
}));
vi.mock('embedded-postgres', () => ({ default: class {
  constructor(options: unknown) { calls.embedded(options); }
  initialise = calls.initialise; start = calls.start; stop = calls.stop; createDatabase = calls.createDatabase;
} }));
vi.mock('pg', () => ({ Client: class {
  constructor(options: unknown) { calls.client(options); }
  connect = calls.connect; query = calls.query; end = calls.end;
} }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.clearAllMocks(); vi.resetModules(); });

describe('local PostgreSQL script credentials', () => {
  it('passes the same configured password to PostgreSQL and its client without logging it', async () => {
    const password = randomBytes(24).toString('base64url');
    vi.stubEnv('DEV_POSTGRES_PASSWORD', password);
    vi.stubEnv('NODE_ENV', 'test');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'setInterval').mockReturnValue({} as ReturnType<typeof setInterval>);
    const listeners = { SIGINT: process.listeners('SIGINT'), SIGTERM: process.listeners('SIGTERM') };
    try {
      await import('../dev-local-pg');
      await vi.waitFor(() => expect(log).toHaveBeenCalled());
      expect(calls.embedded).toHaveBeenCalledWith(expect.objectContaining({ password, port: 5433 }));
      expect(calls.client).toHaveBeenCalledWith(expect.objectContaining({ password, host: '127.0.0.1', database: 'tripri_dev' }));
      expect(calls.query).toHaveBeenCalled();
      expect(calls.end).toHaveBeenCalled();
      expect(JSON.stringify(log.mock.calls)).not.toContain(password);
      expect(JSON.stringify(log.mock.calls)).not.toContain('postgresql://');
    } finally {
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        for (const listener of process.listeners(signal)) if (!listeners[signal].includes(listener)) process.off(signal, listener);
      }
    }
  });
});
