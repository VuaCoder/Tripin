import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import type { TestProject } from 'vitest/node';
import { TEMPLATE_DB } from './constants';

/**
 * One real PostgreSQL server for the whole integration run (started once, no Docker needed). It holds a template
 * database with every migration applied; each test file clones it into a database of its own (see `startDatabase`).
 */
const USER = 'postgres';
const PASSWORD = 'postgres';

declare module 'vitest' {
  export interface ProvidedContext {
    pgAdminUrl: string;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

function migrationSql(): string {
  const dir = path.resolve(__dirname, '../../../prisma/migrations');
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(path.join(dir, name, 'migration.sql'), 'utf-8'))
    .join('\n');
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'tripri-pg-'));
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: USER,
    password: PASSWORD,
    port,
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined,
  });
  await server.initialise();
  await server.start();

  const adminUrl = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${port}/postgres`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${TEMPLATE_DB}`);
  await admin.end();

  const template = new Client({ connectionString: adminUrl.replace(/\/postgres$/, `/${TEMPLATE_DB}`) });
  await template.connect();
  await template.query(migrationSql());
  await template.end();

  project.provide('pgAdminUrl', adminUrl);

  return async () => {
    await server.stop();
    rmSync(dataDir, { recursive: true, force: true });
  };
}
