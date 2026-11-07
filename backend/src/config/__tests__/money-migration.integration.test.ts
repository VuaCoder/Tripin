import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { databaseUrl, startDatabase, stopDatabase } from '../../test/integration';

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);

it('widens all 16 money columns while preserving old values, nulls and defaults', async () => {
  const columns: Record<string, string[]> = {
    Tour: ['basePrice'], TourDeparture: ['priceOverride'], TourGuideAssignment: ['feePerBooking'],
    Booking: ['unitPrice', 'subtotal', 'discountAmount', 'totalAmount', 'commissionAmount', 'agencyAmount'],
    Payment: ['amount'], Earning: ['amount'], Promotion: ['discountValue', 'maxDiscountAmount', 'minOrderAmount'],
    SubscriptionPlan: ['price'], Subscription: ['price'],
  };
  const sql = readFileSync(path.resolve(__dirname, '../../../../prisma/migrations/20261103000000_expand_whole_vnd_storage/migration.sql'), 'utf8');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA money_legacy_test');
    await client.query('SET LOCAL search_path TO money_legacy_test');
    for (const [table, fields] of Object.entries(columns)) {
      await client.query(`CREATE TABLE "${table}" (${fields.map((field) => `"${field}" INTEGER DEFAULT 0`).join(', ')})`);
      await client.query(`INSERT INTO "${table}" VALUES (${fields.map(() => '2147483647').join(', ')}), (${fields.map(() => 'NULL').join(', ')}), (${fields.map(() => 'DEFAULT').join(', ')})`);
    }
    await client.query(sql);
    const types = await client.query("SELECT data_type FROM information_schema.columns WHERE table_schema = 'money_legacy_test'");
    expect(types.rows).toHaveLength(16);
    expect(types.rows.every((row) => row.data_type === 'bigint')).toBe(true);
    for (const [table, fields] of Object.entries(columns)) {
      const result = await client.query(`SELECT * FROM "${table}"`);
      expect(result.rows).toEqual([
        Object.fromEntries(fields.map((field) => [field, '2147483647'])),
        Object.fromEntries(fields.map((field) => [field, null])),
        Object.fromEntries(fields.map((field) => [field, '0'])),
      ]);
      await client.query(`INSERT INTO "${table}" VALUES (${fields.map(() => '50000000000').join(', ')})`);
    }
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
