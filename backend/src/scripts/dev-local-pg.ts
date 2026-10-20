/**
 * DEV-ONLY: starts a throwaway local PostgreSQL (the repo's own embedded-postgres, no Docker) on :5433 with every
 * migration applied, and keeps running until Ctrl+C / kill. Data lives in a temp directory and is discarded on exit.
 *
 *   npx tsx src/scripts/dev-local-pg.ts
 *   -> READY postgresql://postgres:<random>@127.0.0.1:5433/tripri_dev   (use that URL as DATABASE_URL)
 *
 * The superuser password is generated per run and only printed, so nothing is committed; hex keeps it URL-safe.
 */
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';

const PORT = 5433;
const DB = 'tripri_dev';
const PASSWORD = randomBytes(12).toString('hex');
const DATABASE_URL = `postgresql://postgres:${PASSWORD}@127.0.0.1:${PORT}/${DB}`;

async function main() {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'tripri-dev-pg-'));
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: PASSWORD,
    port: PORT,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => undefined,
    onError: () => undefined,
  });
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
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log(`READY ${DATABASE_URL}`);

  const stop = async () => {
    await server.stop().catch(() => undefined);
    rmSync(dataDir, { recursive: true, force: true });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => undefined, 1 << 30);
}

void main();
