import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import { WindowsTestPostgres } from '../test/windows-postgres';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('No TCP port'));
      server.close(() => resolve(address.port));
    });
  });
}

async function main(): Promise<void> {
const root = mkdtempSync(path.join(os.tmpdir(), 'tripri-dev-pg-'));
const port = await freePort();
const server = new WindowsTestPostgres(root, path.join(root, 'data'), port);
let backend: ReturnType<typeof spawn> | undefined;
let closing = false;

async function close(): Promise<void> {
  if (closing) return;
  closing = true;
  backend?.kill();
  await server.stop();
  rmSync(root, { recursive: true, force: true });
}

try {
  await server.initialise();
  await server.start();
  const admin = new Client({ connectionString: `postgresql://postgres@127.0.0.1:${port}/postgres` });
  await admin.connect();
  try { await admin.query('CREATE DATABASE travel_platform_dev'); }
  finally { await admin.end(); }

  const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/travel_platform_dev`;
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    const migrations = path.resolve(import.meta.dirname, '../../../prisma/migrations');
    for (const entry of readdirSync(migrations, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(migrations, entry.name, 'migration.sql');
      if (existsSync(file)) await db.query(readFileSync(file, 'utf8'));
    }
  } finally { await db.end(); }

  console.log(`Local test database migrated on port ${port}`);
  const backendDir = path.resolve(import.meta.dirname, '../..');
  const tsxCli = path.join(backendDir, 'node_modules/tsx/dist/cli.mjs');
  for (const script of ['seed-demo-tours.ts', 'seed-local-agency-accounts.ts', 'seed-local-roster.ts']) {
    await new Promise<void>((resolve, reject) => {
      const seed = spawn(process.execPath, [tsxCli, `src/scripts/${script}`], {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'inherit',
        windowsHide: true,
      });
      seed.once('error', reject);
      seed.once('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited with ${code}`)));
    });
  }
  backend = spawn(process.execPath, [tsxCli, 'watch', 'src/server.ts'], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: databaseUrl, CLIENT_URL: 'http://localhost:3002' },
    stdio: 'inherit',
    windowsHide: true,
  });
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
  await new Promise<void>((resolve) => backend?.once('exit', () => resolve()));
} finally {
  await close();
}
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
