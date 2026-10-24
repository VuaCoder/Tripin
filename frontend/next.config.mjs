import fs from 'node:fs';
import path from 'node:path';

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
  distDir: process.env.TRIPRI_VERIFY_BUILD === '1' ? '.next-verify' : '.next',
};

export default nextConfig;
