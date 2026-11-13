import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// Guarantee that .env.local is removed if present so Next.js never loads or prioritizes it
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  try {
    fs.unlinkSync(envLocalPath);
  } catch {}
}

// Load root .env if present so monorepo variables are always available
const rootEnvPath = path.resolve(process.cwd(), '../.env');
if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch {}
}

// Load frontend .env if present
const frontendEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(frontendEnvPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(frontendEnvPath);
  } catch {}
}

/** A separate output directory lets verification builds run alongside `next dev`. */
const nextConfig = {
  webpack(config, { dev, isServer }) {
    if (dev && !isServer) {
      // Next 14.2.3 bundles an older mini-css-extract-plugin runtime which assumes
      // the old stylesheet is still attached when its replacement finishes loading.
      // App Router navigation / overlapping HMR updates can already have removed it.
      // Scope the upstream-style null guard to this runtime, without editing node_modules.
      const cssHmrRuntime = require.resolve('next/dist/compiled/mini-css-extract-plugin/hmr/hotModuleReplacement.js');
      config.module.rules.push({
        test: resource => resource === cssHmrRuntime,
        enforce: 'pre',
        use: [{ loader: fileURLToPath(new URL('./scripts/css-hmr-detached-link-loader.cjs', import.meta.url)) }],
      });
    }
    return config;
  },
  distDir: process.env.TRIPRI_PREVIEW === '1' ? '.next-preview' : (process.env.TRIPRI_VERIFY_BUILD === '1' ? '.next-verify' : '.next'),
  ...(process.env.TRIPRI_PREVIEW === '1' ? { typescript: { tsconfigPath: 'tsconfig.preview.json' } } : {}),
  // Prune local barrel exports in dev as well as production; keep public APIs intact.
  experimental: {
    optimizePackageImports: [
      '@/features/auth', '@/features/tours', '@/features/booking',
      '@/components/ui', '@/components/shared', '@/components/layout',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
