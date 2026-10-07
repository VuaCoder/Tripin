import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Vite 8 transforms with oxc (`esbuild.jsx` is no longer honoured for the test/SSR transform).
  // Without this, every `.tsx` test fails with "Unexpected JSX expression" when it renders a component.
  oxc: { jsx: 'react-jsx' },
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'jsdom',
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
});
