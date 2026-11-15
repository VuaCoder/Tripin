/** Narrow deployment fallback when Prisma's schema engine cannot connect but pg can.
 * Defaults to the schema migration only; permission changes require separate approval.
 * Never rewrites old history.
 * Usage (cwd backend): tsx src/scripts/apply-tour-services-migrations.ts [--apply] [--include-role-repair]
 */
import { config } from 'dotenv';
import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

config({ path: path.resolve('../.env'), quiet: true });
const names = ['20261114000100_tour_optional_services', '20261114000200_agency_custom_tour_role_defaults'];
const apply = process.argv.includes('--apply');
const selectedNames = process.argv.includes('--include-role-repair') ? names : names.slice(0, 1);
const expectedHost = 'ep-aged-tooth-b3l5wem9.c-4.ap-southeast-1.aws.neon.tech';

async function main() {
  const runtime = new URL(process.env.DATABASE_URL!);
  const direct = new URL(process.env.DATABASE_URL_UNPOOLED!);
  if (direct.hostname !== expectedHost || runtime.hostname.replace('-pooler', '') !== direct.hostname ||
      direct.pathname !== '/neondb' || runtime.pathname !== direct.pathname || runtime.username !== direct.username)
    throw new Error('Target mismatch: refusing to migrate a different database.');
  const client = new Client({ connectionString: direct.href, connectionTimeoutMillis: 10000 });
  await client.connect();
  let locked = false;
  try {
    await client.query("SET lock_timeout = '5s'; SET statement_timeout = '30s'");
    const lock = await client.query('SELECT pg_try_advisory_lock(72707369) AS locked');
    locked = lock.rows[0].locked;
    if (!locked) throw new Error('Another migration is running. Retry later.');
    const history = await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"');
    if (history.rows.some(r => !r.finished_at && !r.rolled_back_at)) throw new Error('Unfinished migration exists.');
    const files = selectedNames.map(name => {
      const sql = readFileSync(path.resolve('../prisma/migrations', name, 'migration.sql'), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
    for (const file of files) {
      const previous = history.rows.find(r => r.migration_name === file.name && r.finished_at && !r.rolled_back_at);
      if (previous && previous.checksum !== file.checksum) throw new Error(`Checksum mismatch: ${file.name}`);
    }
    const pending = files.filter(f => !history.rows.some(r => r.migration_name === f.name && r.finished_at && !r.rolled_back_at));
    const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='Tour' AND column_name='optionalServices') OR (table_name='Booking' AND column_name IN ('serviceSnapshot','servicesSubtotal','meetingPointSnapshot','requestFingerprint')))");
    if (pending.some(f => f.name === names[0]) && columns.rowCount !== 0)
      throw new Error('Partial/out-of-band service migration exists. Reconcile before applying.');
    const counts = await client.query('SELECT (SELECT count(*)::int FROM "Tour") AS tours, (SELECT count(*)::int FROM "Booking") AS bookings');
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'inspect', host: direct.hostname, database: direct.pathname.slice(1), counts: counts.rows[0], pending: pending.map(f => f.name) }));
    if (!apply || !pending.length) return;

    // Permission/function snapshot only: no customer PII, credentials or booking payloads.
    const repairRoles = pending.some(f => f.name === names[1]);
    const roles = repairRoles ? await client.query('SELECT id, "agencyId", "systemRole", permissions, "createdAt", "updatedAt" FROM "AgencyRole" ORDER BY id') : { rows: [] };
    const versions = repairRoles ? await client.query('SELECT id, "permissionVersion" FROM "AgencyProfile" ORDER BY id') : { rows: [] };
    const seed = repairRoles ? await client.query("SELECT pg_get_functiondef('agency_seed_access_roles(uuid)'::regprocedure) AS definition") : { rows: [] };
    const backupDir = path.resolve('../.test-artifacts/db-migrations');
    mkdirSync(backupDir, { recursive: true });
    const backup = path.join(backupDir, `tour-services-before-${Date.now()}.json`);
    writeFileSync(backup, JSON.stringify({ host: direct.hostname, counts: counts.rows[0], history: history.rows, roles: roles.rows, versions: versions.rows, seed: seed.rows[0]?.definition }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(`Migration metadata snapshot: ${backup}`);

    await client.query('BEGIN');
    try {
      for (const file of pending) {
        // Preserve one outer transaction for both files and their history records.
        const sql = file.sql.trim().replace(/^BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
        await client.query(sql);
        await client.query('INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count) VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,1)', [randomUUID(), file.checksum, file.name]);
      }
      const valid = await client.query('SELECT (SELECT count(*) FROM "Tour" WHERE jsonb_typeof("optionalServices") <> \'array\') AS invalid_tours, (SELECT count(*) FROM "Booking" WHERE jsonb_typeof("serviceSnapshot") <> \'array\' OR "servicesSubtotal" < 0) AS invalid_bookings');
      if (valid.rows[0].invalid_tours !== '0' || valid.rows[0].invalid_bookings !== '0') throw new Error('Post-migration validation failed.');
      await client.query('COMMIT');
      console.log(JSON.stringify({ applied: pending.map(f => f.name), validation: valid.rows[0] }));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(72707369)').catch(() => undefined);
    await client.end();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Migration failed'); process.exitCode = 1; });
