import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests share the CPU with many parallel files (each with a PostgreSQL database of its own): generous limits avoid false timeouts.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    setupFiles: ['./src/test/setup-env.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          exclude: ['**/node_modules/**'],
          globalSetup: ['./src/test/global-setup.ts'],
        },
      },
    ],
  },
});
