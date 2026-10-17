import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { connectDatabase, disconnectDatabase, prisma } from '../../config/database';

let databaseUrl: string;
const dbName = `tripri_fixture_${randomBytes(6).toString('hex')}`;
beforeAll(async () => {
  // Windows initdb may default to WIN1252. This fixture contains Vietnamese text;
  // create its own UTF8 database, never alter the shared template or a developer database.
  const admin = new Client({ connectionString: inject('pgAdminUrl') });
  await admin.connect();
  try { await admin.query(`CREATE DATABASE ${dbName} TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`); }
  finally { await admin.end(); }
  const url = new URL(inject('pgAdminUrl'));
  url.pathname = `/${dbName}`;
  databaseUrl = url.toString();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const root = path.resolve('../prisma/migrations');
    for (const entry of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await client.query(readFileSync(path.join(root, entry.name, 'migration.sql'), 'utf8'));
    }
  } finally { await client.end(); }
  await connectDatabase(databaseUrl);
}, 120_000);
afterAll(async () => {
  await disconnectDatabase();
  const admin = new Client({ connectionString: inject('pgAdminUrl') });
  await admin.connect();
  try { await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`); }
  finally { await admin.end(); }
});

describe('agency fixture against a disposable test database', () => {
  it('creates usable accounts with the supplied password, logs no credentials, and cleans without a password', async () => {
    const password = randomBytes(24).toString('base64url');
    const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
    const fixture = path.resolve('src/scripts/dev-agency-fixture.ts');
    const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: databaseUrl!, DEV_FIXTURE_PASSWORD: password };
    const created = spawnSync(process.execPath, [tsx, fixture, 'create'], { env, encoding: 'utf8', timeout: 60_000 });
    expect(created.status).toBe(0);
    expect(created.stdout + created.stderr).not.toContain(password);
    expect(created.stdout + created.stderr).not.toContain(databaseUrl!);
    expect(JSON.parse(created.stdout)).toEqual({ agency: 'dev.agency@tripri.test', otherAgency: 'dev.agency.other@tripri.test' });
    const account = await prisma.user.findUniqueOrThrow({ where: { email: 'dev.agency@tripri.test' } });
    expect(await bcrypt.compare(password, account.passwordHash!)).toBe(true);
    expect(await prisma.promotion.count()).toBe(4);
    expect(await prisma.report.count()).toBe(5);
    const cleaned = spawnSync(process.execPath, [tsx, fixture, 'clean'], { env: { ...env, DEV_FIXTURE_PASSWORD: '' }, encoding: 'utf8', timeout: 60_000 });
    expect(cleaned.status).toBe(0);
    expect(await prisma.user.count({ where: { email: { endsWith: '@tripri.test' } } })).toBe(0);
  }, 120_000);
});
