import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// The single .env lives at the monorepo root (see .env.example). `pnpm --filter backend dev` runs with cwd = backend,
// so both the cwd and the monorepo root are checked; variables already in process.env always win.
dotenv.config({ path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')], quiet: true });

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().default('http://localhost:3000'),

  /** Set JOBS_ENABLED=false on nodes that must not run the periodic sweeps (e.g. when a dedicated worker does). */
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/travel_platform'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  /** Cloudinary media storage. Keep these server-only: never prefix them with NEXT_PUBLIC_. */
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,

  BREVO_API_KEY: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  MAIL_FROM: z.string().default('Tripri <no-reply@tripri.local>'),

  PAYOS_CLIENT_ID: optionalString,
  PAYOS_API_KEY: optionalString,
  PAYOS_CHECKSUM_KEY: optionalString,
  /** Where the payment page sends the browser afterwards (frontend routes). Default: CLIENT_URL's first origin + /payment/*. */
  PAYMENT_RETURN_URL: optionalString,
  PAYMENT_CANCEL_URL: optionalString,

  AI_PROVIDER: z.enum(['disabled', 'anthropic']).default('disabled'),
  AI_API_KEY: optionalString,
  AI_MODEL: optionalString,
});

export type Env = z.infer<typeof envSchema>;

/** Every variable the API reads; a test checks that each one is documented in .env.example. */
export const ENV_KEYS = Object.keys(envSchema.shape);

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration -> ${problems}`);
  }
  const value = parsed.data;
  if (value.NODE_ENV === 'production') {
    if (value.JWT_ACCESS_SECRET.length < 32 || value.JWT_REFRESH_SECRET.length < 32) {
      throw new Error('JWT secrets must be at least 32 characters in production');
    }
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    }
  }
  return value;
}

export const env: Env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
