import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests share the CPU with ~50 parallel files (each with its own mongod): generous limits avoid false timeouts.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
  },
});
