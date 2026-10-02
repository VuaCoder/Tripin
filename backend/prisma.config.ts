import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The single .env lives at the monorepo root; the Prisma CLI runs with cwd = backend.
config({ path: path.resolve(__dirname, '../.env'), quiet: true });

export default defineConfig({
  schema: path.resolve(__dirname, '../prisma/schema.prisma'),
  migrations: {
    path: path.resolve(__dirname, '../prisma/migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/travel_platform',
  },
});
