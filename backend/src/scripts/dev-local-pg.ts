/**
 * DEV-ONLY: starts a throwaway local PostgreSQL (the repo's own embedded-postgres, no Docker) on :5433 with every
 * migration applied, and keeps running until Ctrl+C / kill. Data lives in a temp directory and is discarded on exit.
 *
 *   npx tsx src/scripts/dev-local-pg.ts
 *   Set DEV_POSTGRES_PASSWORD in your ignored root .env before starting.
 *   Connect to 127.0.0.1:5433 / tripri_dev using that password; no credentials are logged.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import dotenv from 'dotenv';
import { assertDevScriptEnvironment, requireDevPassword } from './dev-script-config';

const PORT = 5433;
const DB = 'tripri_dev';

async function main() {
  dotenv.config({ path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')], quiet: true });
  assertDevScriptEnvironment();
  const password = requireDevPassword('DEV_POSTGRES_PASSWORD');
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'tripri-dev-pg-'));
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password,
    port: PORT,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => undefined,
    onError: () => undefined,
  });
  const cleanup = async () => {
    // Only remove the exact temporary directory created by this invocation.
    await server.stop();
    if (path.dirname(dataDir) !== path.resolve(os.tmpdir()) || !path.basename(dataDir).startsWith('tripri-dev-pg-')) {
      throw new Error('Refusing to remove a directory outside this dev process.');
    }
    rmSync(dataDir, { recursive: true, force: true });
  };
  try {
    await server.initialise();
    await server.start();
    await server.createDatabase(DB);

    const migrations = path.resolve(__dirname, '../../../prisma/migrations');
    const sql = readdirSync(migrations, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .map((name) => readFileSync(path.join(migrations, name, 'migration.sql'), 'utf-8'))
      .join('\n');
    const client = new Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password, database: DB });
    try {
      await client.connect();
      await client.query(sql);
    } finally {
      await client.end();
    }
    console.log(`READY local PostgreSQL on 127.0.0.1:${PORT}, database ${DB} (credentials omitted)`);

    const stop = async () => {
      await cleanup();
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    setInterval(() => undefined, 1 << 30);
  } catch {
    await cleanup().catch(() => undefined);
    throw new Error('Local PostgreSQL setup failed.');
  }
}

void main().catch(() => {
  console.error('Local PostgreSQL setup failed. Check DEV_POSTGRES_PASSWORD, port availability and migrations.');
  process.exitCode = 1;
});
