import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Vite 8 transforms with oxc (`esbuild.jsx` is no longer honoured for the test/SSR transform).
  // Without this, `.tsx` tests fail with "Unexpected JSX expression" when they render a component.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '@travel-platform/constants': path.resolve(__dirname, '../packages/constants/src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
});
