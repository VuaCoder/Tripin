import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { TEMPLATE_DB } from '../../test/constants';

const execute = promisify(execFile);
const databaseName = `tripri_guide_finance_${randomBytes(6).toString('hex')}`;
let admin: Client;
let db: Client;
let databaseUrl: string;

beforeAll(async () => {
  const adminUrl = inject('pgAdminUrl');
  admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE ${TEMPLATE_DB}`);
  databaseUrl = adminUrl.replace(/\/[^/]*$/, `/${databaseName}`);
  db = new Client({ connectionString: databaseUrl });
  await db.connect();
}, 120_000);

afterAll(async () => {
  await db?.end();
  // The generated name is limited to this fixture's prefix and random hex.
  if (/^tripri_guide_finance_[a-f0-9]+$/.test(databaseName))
    await admin?.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
  await admin?.end();
});

const runFixture = (action: string, url = databaseUrl) =>
  execute(
    process.execPath,
    [
      path.resolve('node_modules/tsx/dist/cli.mjs'),
      'src/scripts/dev-guide-finance-fixture.ts',
      action,
    ],
    {
      cwd: path.resolve('.'),
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url },
    },
  );

describe('disposable Guide finance fixture', () => {
  it('creates repeatable subscription/earnings states, then cleans only its own data', async () => {
    await runFixture('create');
    await runFixture('create');
    expect(
      (await db.query('SELECT COUNT(*)::int AS count FROM "User"')).rows[0]
        .count,
    ).toBe(4);
    expect(
      (await db.query('SELECT COUNT(*)::int AS count FROM "Earning"')).rows[0]
        .count,
    ).toBe(12);
    expect(
      (await db.query('SELECT COUNT(*)::int AS count FROM "Subscription"'))
        .rows[0].count,
    ).toBe(6);
    await db.query(
      `INSERT INTO "Category" (id, name, slug, "updatedAt") VALUES ($1, 'Unrelated', 'unrelated', NOW())`,
      ['00000000-0000-4000-8000-000000000001'],
    );
    await runFixture('clean');
    expect(
      (await db.query('SELECT COUNT(*)::int AS count FROM "User"')).rows[0]
        .count,
    ).toBe(0);
    expect(
      (await db.query('SELECT COUNT(*)::int AS count FROM "SubscriptionPlan"'))
        .rows[0].count,
    ).toBe(0);
    expect(
      (await db.query('SELECT COUNT(*)::int AS count FROM "Category"')).rows[0]
        .count,
    ).toBe(1);
  });

  it('refuses remote/shared database targets before creating fixtures', async () => {
    await expect(
      runFixture(
        'create',
        'postgresql://example.invalid/tripri_guide_finance',
      ),
    ).rejects.toMatchObject({ stderr: expect.stringContaining('LOOPBACK') });
  });
});
