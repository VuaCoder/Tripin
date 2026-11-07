import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';
import { logger } from '../utils/logger';
import { env } from './env';

export type { Prisma } from '../generated/prisma/client';
export type DbClient = PrismaClient;
/** Anything that runs queries: the shared client or the transaction client handed to `prisma.$transaction`. */
export type DbExecutor = Pick<PrismaClient, Exclude<keyof PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>>;
export type TransactionRunner = <T>(work: (tx: DbExecutor) => Promise<T>) => Promise<T>;

/** Cross-module work must pass this client down to every participating repository. */
export const runInTransaction: TransactionRunner = (work) =>
  prisma.$transaction(work, { maxWait: 15_000, timeout: 20_000 });

let client: PrismaClient | undefined;
let sharedPool: Pool | undefined;

export interface ConnectOptions {
  /** Called with every SQL statement Prisma sends (used by the query-plan test). */
  onQuery?: (sql: string) => void;
}

function getPool(connectionString: string): Pool {
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    sharedPool.on('error', (err) => {
      logger.warn('Pg pool idle client reset', { error: err.message });
    });
  }
  return sharedPool;
}

function createClient(connectionString: string, options: ConnectOptions = {}): PrismaClient {
  const pool = getPool(connectionString);
  const adapter = new PrismaPg(pool);
  if (!options.onQuery) return new PrismaClient({ adapter });
  const logged = new PrismaClient({ adapter, log: [{ emit: 'event', level: 'query' }] });
  (logged as unknown as { $on: (event: 'query', listener: (e: { query: string }) => void) => void }).$on('query', (event) => options.onQuery!(event.query));
  return logged;
}

function current(): PrismaClient {
  client ??= createClient(env.DATABASE_URL);
  return client;
}

/**
 * The shared Prisma client. A thin proxy so repositories can import it as a constant while tests (and
 * `connectDatabase`) decide which database it talks to.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get: (_target, property) => {
    const value = Reflect.get(current(), property) as unknown;
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(current()) : value;
  },
});

/** Connects (and verifies) the database. `url` overrides DATABASE_URL (used by the integration tests). */
export async function connectDatabase(url?: string, options?: ConnectOptions): Promise<void> {
  if (client) await client.$disconnect();
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = undefined;
  }
  client = createClient(url ?? env.DATABASE_URL, options);
  await client.$connect();
  logger.info('PostgreSQL connected');
}

export async function disconnectDatabase(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = undefined;
  }
}

/** Prisma throws P2025 when the row to update/delete does not exist; repositories report that as `null`. */
export function nullIfNotFound(error: unknown): null {
  if ((error as { code?: string }).code === 'P2025') return null;
  throw error;
}

/**
 * True when a write failed on a unique constraint (Prisma P2002). With `field`, only when that column took part
 * in the violated constraint.
 */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  const e = error as {
    code?: string;
    meta?: { target?: string[] | string; driverAdapterError?: { cause?: { constraint?: { fields?: string[]; index?: string } } } };
  };
  if (e?.code !== 'P2002') return false;
  if (!field) return true;
  const target = e.meta?.target;
  const constraint = e.meta?.driverAdapterError?.cause?.constraint;
  const names = [...(Array.isArray(target) ? target : target ? [target] : []), ...(constraint?.fields ?? []), ...(constraint?.index ? [constraint.index] : [])];
  return names.some((name) => name.includes(field));
}
