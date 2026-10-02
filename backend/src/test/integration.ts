import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';
import { inject, vi } from 'vitest';
import { ROLES, TOUR_STATUS, USER_STATUS } from '@travel-platform/constants';
import type { Express } from 'express';
import { connectDatabase, disconnectDatabase, prisma, type Prisma } from '../config/database';
import { mailProvider } from '../integrations/mail';
import { signAccessToken } from '../modules/auth/auth.tokens';
import { canonicalize } from '../modules/payments/providers/payos.provider';
import { hmacSha256 } from '../utils/crypto';
import { TEMPLATE_DB } from './constants';

/**
 * Helpers for `*.integration.test.ts`: a real PostgreSQL database behind the real Express app.
 * The server and the migrated template database are created once per run (`global-setup.ts`); every test file
 * clones the template into a database of its own, so files can run in parallel without seeing each other's rows.
 */
let databaseName: string | undefined;
/** URL of the database created for the current test file (read by tests that spawn a child process). */
export let databaseUrl: string | undefined;

const withDatabase = (adminUrl: string, name: string) => adminUrl.replace(/\/[^/]*$/, `/${name}`);

async function adminQuery(sql: string): Promise<void> {
  const admin = new Client({ connectionString: inject('pgAdminUrl') });
  await admin.connect();
  try {
    await admin.query(sql);
  } finally {
    await admin.end();
  }
}

export async function startDatabase(): Promise<void> {
  databaseName = `tripri_test_${randomBytes(6).toString('hex')}`;
  await adminQuery(`CREATE DATABASE ${databaseName} TEMPLATE ${TEMPLATE_DB}`);
  databaseUrl = withDatabase(inject('pgAdminUrl'), databaseName);
  await connectDatabase(databaseUrl);
}

export async function stopDatabase(): Promise<void> {
  await disconnectDatabase();
  if (databaseName) await adminQuery(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
  databaseName = undefined;
  databaseUrl = undefined;
}

/** Empties every table but keeps the schema. */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

/** Replaces the mail transport with an in-memory outbox so OTP codes can be read back. */
export function captureMail() {
  const outbox: { to: string; subject: string; text: string }[] = [];
  vi.spyOn(mailProvider, 'send').mockImplementation(async (message) => {
    outbox.push({ to: message.to, subject: message.subject, text: message.text });
  });
  return {
    outbox,
    /** Latest 6-digit code sent to `email`. */
    codeFor(email: string): string {
      const mail = [...outbox].reverse().find((m) => m.to === email && /\d{6}/.test(m.text));
      if (!mail) throw new Error(`No OTP mail for ${email}`);
      return /(\d{6})/.exec(mail.text)![1]!;
    },
  };
}

export const PASSWORD = 'Passw0rdTest';

/** Real flow: register -> read OTP from the outbox -> verify-otp. Returns the session. */
export async function registerAndVerify(app: Express, mail: ReturnType<typeof captureMail>, email: string, fullName = 'Test Traveler') {
  const registered = await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, fullName });
  if (registered.status !== 201) throw new Error(`register failed: ${registered.status} ${JSON.stringify(registered.body)}`);
  const verified = await request(app).post('/api/v1/auth/verify-otp').send({ email, code: mail.codeFor(email), purpose: 'REGISTER' });
  if (verified.status !== 200) {
    const otps = await prisma.otp.findMany();
    const mails = mail.outbox.filter((m) => m.to === email).map((m) => m.text.slice(0, 60));
    throw new Error(`verify failed: ${verified.status} ${JSON.stringify(verified.body)} mails=${JSON.stringify(mails)} otps=${JSON.stringify(otps)} usedCode=${mail.codeFor(email)}`);
  }
  return {
    token: verified.body.data.accessToken as string,
    userId: verified.body.data.user.id as string,
    cookies: verified.headers['set-cookie'] as unknown as string[],
  };
}

type AgencyProfileInput = Omit<Prisma.AgencyProfileUncheckedCreateInput, 'userId'>;

/** Active account created straight in the database (agencies are not part of the flow under test). */
export async function createUser(
  role: Exclude<keyof typeof ROLES, 'GUEST'>,
  email: string,
  overrides: { agencyProfile?: AgencyProfileInput; status?: keyof typeof USER_STATUS } & Record<string, unknown> = {},
) {
  const { agencyProfile, ...rest } = overrides;
  const user = await prisma.user.create({
    data: {
      email,
      fullName: `${role} ${email}`,
      role,
      status: USER_STATUS.ACTIVE,
      ...(rest as object),
      ...(agencyProfile ? { agencyProfile: { create: agencyProfile } } : {}),
    },
  });
  return { id: user.id, token: signAccessToken(user.id, user.role as never) };
}

/** An APPROVED tour with one departure `daysAhead` days from now. */
export async function createApprovedTour(agencyId: string, options: { capacity?: number; price?: number; daysAhead?: number } = {}) {
  const { capacity = 10, price = 1_000_000, daysAhead = 30 } = options;
  const tour = await prisma.tour.create({
    data: {
      agencyId,
      title: 'Ha Long Bay 2D1N',
      destination: 'Quang Ninh',
      durationDays: 2,
      basePrice: price,
      status: TOUR_STATUS.APPROVED,
      departures: { create: [{ date: new Date(Date.now() + daysAhead * 86_400_000), capacity, remaining: capacity }] },
    },
    include: { departures: true },
  });
  return { tourId: tour.id, departureId: tour.departures[0]!.id, capacity };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Fake PayOS HTTP API (create payment link). Needs PAYOS_* env vars set via `vi.hoisted` before the app is imported. */
export function stubPayosApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ code: '00', desc: 'success', data: { paymentLinkId: 'pl_test_1', checkoutUrl: 'https://pay.example/checkout/1' } })),
  );
}

export const PAYOS_TEST_ENV = { PAYOS_CLIENT_ID: 'test-client', PAYOS_API_KEY: 'test-api-key', PAYOS_CHECKSUM_KEY: 'test-checksum-key' } as const;

/** A webhook body signed exactly like PayOS does (checksum key = PAYOS_TEST_ENV). */
export function signedPayosWebhook(orderCode: number, amount: number, overrides: { success?: boolean; code?: string } = {}) {
  const data = {
    orderCode,
    amount,
    description: 'TRIPRI',
    accountNumber: '123',
    reference: 'FT123',
    transactionDateTime: '2026-10-02 10:00:00',
    currency: 'VND',
    paymentLinkId: 'pl_test_1',
    code: overrides.code ?? '00',
    desc: 'success',
  };
  return {
    code: overrides.code ?? '00',
    desc: 'success',
    success: overrides.success ?? true,
    data,
    signature: hmacSha256(PAYOS_TEST_ENV.PAYOS_CHECKSUM_KEY, canonicalize(data)),
  };
}

/** An agency whose profile the moderators have verified (needed to submit tours for review). */
export const createVerifiedAgency = (email: string) =>
  createUser('AGENCY', email, { agencyProfile: { companyName: 'Verified Travel Co', verificationStatus: 'VERIFIED' } });

export async function createCategory(name = 'Beach') {
  const category = await prisma.category.create({ data: { name, slug: name.toLowerCase() } });
  return category.id;
}

/** A tour with the relations tests assert on (departures by date, the guide assignment). */
export const loadTour = (id: string) =>
  prisma.tour.findUnique({ where: { id }, include: { departures: { orderBy: { date: 'asc' } }, guideAssignment: true } });

// ---- query-plan audit ---------------------------------------------------------------------------------------

const recordedSql = new Set<string>();

/** Starts recording the SQL Prisma sends from now on (see `findInefficientQueries`). */
export async function startQueryRecording(): Promise<void> {
  recordedSql.clear();
  await connectDatabase(databaseUrl, { onQuery: (sql) => recordedSql.add(sql) });
}

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  Plans?: PlanNode[];
}

function planNodes(node: PlanNode, out: PlanNode[] = []): PlanNode[] {
  out.push(node);
  for (const child of node.Plans ?? []) planNodes(child, out);
  return out;
}

/**
 * Asks PostgreSQL how every recorded statement would run with sequential scans and explicit sorts disabled:
 * a `Seq Scan` or `Sort` left in the plan means no index can serve that statement (filter + order) by itself.
 */
export async function findInefficientQueries(): Promise<{ sql: string; scans: string[]; sorts: boolean }[]> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const offenders: { sql: string; scans: string[]; sorts: boolean }[] = [];
  try {
    await client.query('SET enable_seqscan = off; SET enable_sort = off;');
    for (const sql of recordedSql) {
      if (!/^\s*(SELECT|UPDATE|DELETE)/i.test(sql) || !/\bWHERE\b|\bORDER BY\b/i.test(sql)) continue;
      try {
        const result = await client.query(`EXPLAIN (GENERIC_PLAN, FORMAT JSON) ${sql}`);
        const plan = (result.rows[0]['QUERY PLAN'] as { Plan: PlanNode }[])[0]!.Plan;
        const nodes = planNodes(plan);
        const scans = nodes.filter((n) => n['Node Type'] === 'Seq Scan').map((n) => n['Relation Name'] ?? '?');
        const sorts = nodes.some((n) => n['Node Type'] === 'Sort');
        if (scans.length > 0 || sorts) offenders.push({ sql, scans, sorts });
      } catch {
        /* a statement that cannot be explained (e.g. DDL-ish) is simply not audited */
      }
    }
  } finally {
    await client.end();
  }
  return offenders;
}
