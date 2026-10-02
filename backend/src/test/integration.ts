import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { vi } from 'vitest';
import { ROLES, TOUR_STATUS, USER_STATUS } from '@travel-platform/constants';
import type { Express } from 'express';
import { mailProvider } from '../integrations/mail';
import { UserModel } from '../modules/users/users.model';
import { TourModel } from '../modules/tours/tours.model';
import { CategoryModel } from '../modules/categories/categories.model';
import { signAccessToken } from '../modules/auth/auth.tokens';
import { hmacSha256 } from '../utils/crypto';
import { canonicalize } from '../modules/payments/providers/payos.provider';

/**
 * Helpers for `*.integration.test.ts`: a real MongoDB (mongodb-memory-server) behind the real Express app.
 * Import the app (and therefore every model) BEFORE calling `startDatabase`, so unique indexes are built up front.
 */
let server: MongoMemoryServer | undefined;

/**
 * Optional query-plan audit (`EXPLAIN_REPORT=<file> pnpm --filter backend test`): every read/update filter the tests send to
 * MongoDB is recorded, explained on the real data at the end of the file, and any COLLSCAN is appended to <file>.
 * `src/test/explain-report.test.ts`-style analysis then decides which indexes are missing.
 */
interface RecordedOp {
  collection: string;
  method: string;
  filter: Record<string, unknown>;
  options: Record<string, unknown>;
  pipeline?: Record<string, unknown>[];
}
const recorded = new Map<string, RecordedOp>();
const READ_METHODS = new Set(['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'updateMany', 'countDocuments', 'count']);

function recordOps(): void {
  mongoose.set('debug', (collection: string, method: string, ...args: unknown[]) => {
    if (recorded.size > 600) return;
    let op: RecordedOp | undefined;
    if (method === 'aggregate') {
      op = { collection, method, filter: {}, options: {}, pipeline: args[0] as Record<string, unknown>[] };
    } else if (READ_METHODS.has(method)) {
      const options = method === 'find' || method === 'findOne' || method === 'countDocuments' ? args[1] : args[2];
      op = { collection, method, filter: (args[0] ?? {}) as Record<string, unknown>, options: (options ?? {}) as Record<string, unknown> };
    }
    if (!op) return;
    const shape = JSON.stringify([op.collection, op.method, Object.keys(op.filter).sort(), Object.keys((op.options?.sort as object) ?? {}), op.pipeline?.map((stage) => Object.keys(stage)[0])]);
    if (!recorded.has(shape)) recorded.set(shape, op);
  });
}

function planStages(plan: unknown, out: string[] = []): string[] {
  if (plan && typeof plan === 'object') {
    const node = plan as Record<string, unknown>;
    if (typeof node.stage === 'string') out.push(node.stage + (node.indexName ? `(${String(node.indexName)})` : ''));
    for (const value of Object.values(node)) planStages(value, out);
  }
  return out;
}

/** Explains every recorded operation; returns those that scan a whole collection or sort in memory. */
export async function findInefficientQueries(): Promise<{ collection: string; method: string; filter: unknown; sort?: unknown; stages: string[] }[]> {
  const offenders: { collection: string; method: string; filter: unknown; sort?: unknown; stages: string[] }[] = [];
  for (const op of recorded.values()) {
    try {
      const collection = mongoose.connection.collection(op.collection);
      const explained =
        op.method === 'aggregate'
          ? await collection.aggregate(op.pipeline!).explain('queryPlanner')
          : await collection.find(op.filter, { sort: op.options?.sort as never, limit: 1000 }).explain('queryPlanner');
      const planner = (explained as { queryPlanner?: { winningPlan?: unknown } }).queryPlanner;
      const stages = planStages(planner?.winningPlan ?? explained);
      if ((stages.includes('COLLSCAN') || stages.includes('SORT')) && (Object.keys(op.filter).length > 0 || op.pipeline || op.options?.sort)) {
        offenders.push({ collection: op.collection, method: op.method, filter: op.filter, sort: op.options?.sort, stages });
      }
    } catch {
      /* an op that cannot be explained (e.g. a pipeline stage that needs a special context) is simply not audited */
    }
  }
  return offenders;
}

async function reportCollectionScans(file: string): Promise<void> {
  const { appendFileSync } = await import('node:fs');
  for (const offender of await findInefficientQueries()) appendFileSync(file, JSON.stringify(offender) + String.fromCharCode(10));
}

/** Starts recording the queries of the following requests (see `findInefficientQueries`). */
export function startQueryRecording(): void {
  recorded.clear();
  recordOps();
}

export async function startDatabase(): Promise<void> {
  server = await MongoMemoryServer.create();
  mongoose.set('strictQuery', true);
  // A database name of its own: even if two test files ever ended up on the same mongod (port clash), their data stays apart.
  await mongoose.connect(server.getUri(), { dbName: `tripri_test_${randomBytes(6).toString('hex')}` });
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  if (process.env.EXPLAIN_REPORT) recordOps();
}

export async function stopDatabase(): Promise<void> {
  if (process.env.EXPLAIN_REPORT) await reportCollectionScans(process.env.EXPLAIN_REPORT);
  await mongoose.disconnect();
  await server?.stop();
}

/** Empties every collection but keeps the indexes. */
export async function resetDatabase(): Promise<void> {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
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
    const otps = await mongoose.connection.collection('otps').find({}).toArray();
    const mails = mail.outbox.filter((m) => m.to === email).map((m) => m.text.slice(0, 60));
    throw new Error(`verify failed: ${verified.status} ${JSON.stringify(verified.body)} mails=${JSON.stringify(mails)} otps=${JSON.stringify(otps)} usedCode=${mail.codeFor(email)}`);
  }
  return {
    token: verified.body.data.accessToken as string,
    userId: verified.body.data.user.id as string,
    cookies: verified.headers['set-cookie'] as unknown as string[],
  };
}

/** Active account created straight in the database (agencies are not part of the flow under test). */
export async function createUser(role: Exclude<keyof typeof ROLES, 'GUEST'>, email: string, overrides: Record<string, unknown> = {}) {
  const user = await UserModel.create({ email, fullName: `${role} ${email}`, role, status: USER_STATUS.ACTIVE, ...overrides });
  return { id: user.id as string, token: signAccessToken(user.id, user.role as never) };
}

/** An APPROVED tour with one departure `daysAhead` days from now. */
export async function createApprovedTour(agencyId: string, options: { capacity?: number; price?: number; daysAhead?: number } = {}) {
  const { capacity = 10, price = 1_000_000, daysAhead = 30 } = options;
  const tour = await TourModel.create({
    agencyId,
    title: 'Ha Long Bay 2D1N',
    destination: 'Quang Ninh',
    durationDays: 2,
    basePrice: price,
    status: TOUR_STATUS.APPROVED,
    departures: [{ date: new Date(Date.now() + daysAhead * 86_400_000), capacity, remaining: capacity }],
  });
  return { tourId: tour.id as string, departureId: String(tour.departures[0]!._id), capacity };
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
  const category = await CategoryModel.create({ name, slug: name.toLowerCase() });
  return category.id as string;
}
