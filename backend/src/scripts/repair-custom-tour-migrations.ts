/** Reconcile the partially deployed group-booking migration without resetting existing data.
 * Usage: tsx src/scripts/repair-custom-tour-migrations.ts [--apply]
 * Reads the committed migrations, validates existing objects, then deploys only missing statements.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { env } from '../config/env';

const names = ['20261112000000_custom_tour_requests', '20261112190000_custom_tour_start_date'];

async function main() {
  if (env.NODE_ENV !== 'development') throw new Error('Development database required.');
  const runtime = new URL(env.DATABASE_URL);
  const direct = new URL(process.env.DATABASE_URL_UNPOOLED || env.DATABASE_URL);
  direct.hostname = direct.hostname.replace('-pooler.', '.');
  if (runtime.hostname.replace('-pooler.', '.') !== direct.hostname || runtime.pathname !== direct.pathname || runtime.username !== direct.username) throw new Error('Database mismatch.');
  const client = new Client({ connectionString: direct.href, connectionTimeoutMillis: 15000 });
  await client.connect();
  try {
    await client.query("SET lock_timeout='5s'; SET statement_timeout='30s'");
    const lock = await client.query('SELECT pg_try_advisory_lock(72707369) AS locked');
    if (!lock.rows[0].locked) throw new Error('Another migration is running.');
    const history = (await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"')).rows;
    if (history.some(r => !r.finished_at && !r.rolled_back_at)) throw new Error('Unfinished migration exists.');
    const columns = (await client.query("SELECT table_name,column_name,udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('Tour','Booking','CustomTourRequest','BookingPassenger')")).rows;
    const enums = (await client.query("SELECT typname,enumlabel FROM pg_type JOIN pg_enum ON enumtypid=pg_type.oid WHERE typname IN ('TourVisibility','CustomTourStatus','PassengerType') ORDER BY enumsortorder")).rows;
    const indexes = (await client.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('Booking','BookingPassenger','CustomTourRequest')")).rows;
    const constraints = (await client.query("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='\"BookingPassenger\"'::regclass")).rows;
    const counts = (await client.query('SELECT (SELECT count(*)::int FROM "Tour") AS tours, (SELECT count(*)::int FROM "Booking") AS bookings, (SELECT count(*)::int FROM "BookingPassenger") AS passengers')).rows[0];
    const files = names.map(name => {
      const sql = readFileSync(path.resolve('../prisma/migrations', name, 'migration.sql'), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = history.find(r => r.migration_name === name && r.finished_at && !r.rolled_back_at);
      if (applied && applied.checksum !== checksum) throw new Error(`Checksum differs: ${name}`);
      const statements = sql.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean);
      return { name, checksum, applied: Boolean(applied), statements };
    });
    const skipped: string[] = [];
    const plan = files.filter(f => !f.applied).map(file => ({ ...file, statements: file.statements.filter(sql => {
      const type = /^CREATE TYPE "([^"]+)" AS ENUM/.exec(sql)?.[1];
      if (type && enums.some(e => e.typname === type)) {
        const expected = [...sql.matchAll(/'([^']+)'/g)].map(m => m[1]);
        const actual = enums.filter(e => e.typname === type).map(e => e.enumlabel);
        if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Existing enum differs: ${type}`);
        skipped.push(`enum ${type}`); return false;
      }
      const table = /^CREATE TABLE "([^"]+)"/.exec(sql)?.[1];
      if (table && columns.some(c => c.table_name === table)) {
        const expected = [...sql.matchAll(/^\s*"([^"]+)"\s+(UUID|TEXT|INTEGER|JSONB|TIMESTAMP\(3\)|"[^"]+")/gm)];
        for (const match of expected) {
          const column = columns.find(c => c.table_name === table && c.column_name === match[1]);
          const types: Record<string, string> = { UUID: 'uuid', TEXT: 'text', INTEGER: 'int4', JSONB: 'jsonb', 'TIMESTAMP(3)': 'timestamp' };
          const expectedType = types[match[2]!] ?? match[2]!.replaceAll('"', '');
          if (!column || column.udt_name !== expectedType) throw new Error(`Existing column differs: ${table}.${match[1]}`);
        }
        skipped.push(`table ${table}`); return false;
      }
      const addedColumn = /^ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)"\s+(UUID|TIMESTAMP\(3\)|"[^"]+")/.exec(sql);
      if (addedColumn) {
        const current = columns.find(c => c.table_name === addedColumn[1] && c.column_name === addedColumn[2]);
        if (current) {
          const expected = addedColumn[3] === 'UUID' ? 'uuid' : addedColumn[3] === 'TIMESTAMP(3)' ? 'timestamp' : addedColumn[3]!.replaceAll('"', '');
          if (current.udt_name !== expected) throw new Error('Existing column type differs.');
          skipped.push(`column ${addedColumn[1]}.${addedColumn[2]}`); return false;
        }
      }
      const index = /^CREATE (?:UNIQUE )?INDEX "([^"]+)"/.exec(sql)?.[1];
      if (index && indexes.some(i => i.indexname === index)) {
        const current = indexes.find(i => i.indexname === index)!;
        if (current.indexdef.includes('UNIQUE') !== sql.includes('UNIQUE')) throw new Error('Index uniqueness differs.');
        skipped.push(`index ${index}`); return false;
      }
      const constraint = /^ALTER TABLE "BookingPassenger" ADD CONSTRAINT "([^"]+)"/.exec(sql)?.[1];
      if (constraint && constraints.some(c => c.conname === constraint)) {
        const current = constraints.find(c => c.conname === constraint)!;
        if (!current.definition.includes('REFERENCES "Booking"(id)') || !current.definition.includes('ON DELETE CASCADE')) throw new Error('Existing passenger foreign key differs.');
        skipped.push(`constraint ${constraint}`); return false;
      }
      return true;
    }) }));
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'inspect', pending: plan.map(f => ({ name: f.name, statements: f.statements.length })), skipped, counts }));
    if (!process.argv.includes('--apply') || !plan.length) return;
    const backup = path.resolve('../.test-artifacts/db-migrations');
    mkdirSync(backup, { recursive: true });
    writeFileSync(path.join(backup, `custom-tours-before-${Date.now()}.json`), JSON.stringify({ history, columns, enums, indexes, constraints, counts, skipped }, null, 2), { encoding: 'utf8', flag: 'wx' });
    await client.query('BEGIN');
    try {
      for (const file of plan) {
        for (const sql of file.statements) await client.query(sql);
        await client.query('INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count) VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,1)', [randomUUID(), file.checksum, file.name]);
      }
      await client.query('SELECT "startDate", "guestCounts", "checkoutDraft" FROM "CustomTourRequest" LIMIT 1');
      const after = (await client.query('SELECT (SELECT count(*)::int FROM "Tour") AS tours, (SELECT count(*)::int FROM "Booking") AS bookings, (SELECT count(*)::int FROM "BookingPassenger") AS passengers')).rows[0];
      if (JSON.stringify(counts) !== JSON.stringify(after)) throw new Error('Existing row counts changed.');
      await client.query('COMMIT');
      console.log(JSON.stringify({ applied: plan.map(f => f.name), preserved: after }));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally {
    await client.query('SELECT pg_advisory_unlock(72707369)').catch(() => undefined);
    await client.end();
  }
}
void main().catch(error => { console.error(error.message); process.exitCode = 1; });
