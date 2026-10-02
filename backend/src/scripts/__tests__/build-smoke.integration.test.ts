import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

// The production artefact: `tsup` bundle started with plain `node`, exactly like `pnpm --filter backend start`.
// Built into a temp folder so the developer's own dist/ is never touched.
const apiRoot = process.cwd(); // vitest runs with cwd = backend
const tsupCli = path.join(apiRoot, 'node_modules/tsup/dist/cli-default.js');
let outDir = '';
let mongo: MongoMemoryServer;
let server: ChildProcess | undefined;
let output = '';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
    probe.on('error', reject);
  });
}

async function waitForHealth(port: number, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`server did not answer within ${timeoutMs} ms: ${String(lastError)}\n${output}`);
}

beforeAll(async () => {
  outDir = mkdtempSync(path.join(os.tmpdir(), 'tripri-build-'));
  const build = spawnSync(process.execPath, [tsupCli, '--out-dir', outDir], { cwd: apiRoot, encoding: 'utf-8' });
  if (build.status !== 0) throw new Error(`tsup failed:\n${build.stdout}\n${build.stderr}`);
  mongo = await MongoMemoryServer.create();
}, 180_000);

afterAll(async () => {
  if (server && !server.killed) server.kill('SIGKILL');
  await mongo?.stop();
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('production build (integration)', () => {
  it('bundles into one file, inlines the workspace package and keeps secrets out of it', () => {
    const files = readdirSync(outDir);
    expect(files).toContain('server.js');
    const bundle = readFileSync(path.join(outDir, 'server.js'), 'utf-8');
    expect(bundle).not.toContain('@travel-platform/constants'); // bundled in, not required at runtime
    expect(bundle).not.toMatch(/hunter2|test-access-secret|BEGIN (RSA )?PRIVATE KEY/);
    expect(existsSync(path.join(outDir, 'server.js.map'))).toBe(true);
  });

  it('boots with plain node against a real database, serves the API, and shuts down cleanly on SIGTERM', async () => {
    const port = await freePort();
    server = spawn(process.execPath, [path.join(outDir, 'server.js')], {
      cwd: outDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        MONGODB_URI: `${mongo.getUri()}tripri_build`,
        JWT_ACCESS_SECRET: 'build-smoke-access-secret-0123456789abcdef',
        JWT_REFRESH_SECRET: 'build-smoke-refresh-secret-0123456789abcdef',
        CLIENT_URL: 'http://localhost:3000',
        JOBS_ENABLED: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.on('data', (chunk) => (output += String(chunk)));
    server.stderr?.on('data', (chunk) => (output += String(chunk)));

    const health = await waitForHealth(port, 30_000);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ success: true, data: { status: 'ok' } });

    // A request that needs the database proves the connection and the bundled models work.
    const register = await fetch(`http://127.0.0.1:${port}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'smoke@example.com', password: 'Passw0rdTest', fullName: 'Smoke Test' }),
    });
    expect(register.status).toBe(201);
    const tours = await fetch(`http://127.0.0.1:${port}/api/v1/tours`);
    expect(tours.status).toBe(200);

    // Production headers are on.
    expect(health.headers.get('strict-transport-security')).toBeTruthy();
    expect(health.headers.get('x-powered-by')).toBeNull();

    // Graceful shutdown: SIGTERM ends the process (on Windows Node reports the signal-less exit code).
    const exited = new Promise<number | null>((resolve) => server!.once('exit', (code) => resolve(code)));
    server.kill('SIGTERM');
    const code = await Promise.race([exited, new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 15_000))]);
    expect(code).not.toBe('timeout');
  }, 90_000);

  it('refuses to start in production with weak or identical JWT secrets', async () => {
    const run = (env: Record<string, string>) =>
      spawnSync(process.execPath, [path.join(outDir, 'server.js')], {
        cwd: outDir,
        env: { ...process.env, NODE_ENV: 'production', MONGODB_URI: mongo.getUri(), ...env },
        encoding: 'utf-8',
        timeout: 20_000,
      });
    const weak = run({ JWT_ACCESS_SECRET: 'too-short-secret-16', JWT_REFRESH_SECRET: 'too-short-secret-17' });
    expect(weak.status).not.toBe(0);
    expect(`${weak.stdout}${weak.stderr}`).toMatch(/at least 32 characters/);
    const same = 'identical-secret-0123456789abcdef0123456789';
    const identical = run({ JWT_ACCESS_SECRET: same, JWT_REFRESH_SECRET: same });
    expect(identical.status).not.toBe(0);
    expect(`${identical.stdout}${identical.stderr}`).toMatch(/must differ/);
  }, 60_000);
});

describe('placeholder modules (carts, custom tours)', () => {
  it('contain only their README and expose no route', async () => {
    for (const name of ['carts', 'custom-tours']) {
      const dir = path.join(apiRoot, 'src/modules', name);
      expect(readdirSync(dir)).toEqual(['README.md']);
    }
    const app = createApp();
    for (const url of ['/api/v1/carts', '/api/v1/custom-tours', '/api/v1/cart']) {
      expect((await request(app).get(url)).status, url).toBe(404);
      expect((await request(app).post(url).send({})).status, url).toBe(404);
    }
  });
});
