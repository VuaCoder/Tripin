import { defineConfig } from 'tsup';

// Production bundle: one CommonJS file. Third-party packages stay external (installed from package.json);
// the workspace package @travel-platform/constants ships TypeScript source, so it must be bundled in.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  target: 'node20',
  noExternal: ['@travel-platform/constants'],
});
