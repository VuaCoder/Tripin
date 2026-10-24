import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(frontendDir, '..');

// 1. Remove any .env.local in frontend directory to guarantee only .env is used
const envLocalPath = path.join(frontendDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  try {
    fs.unlinkSync(envLocalPath);
    console.log('[env] Removed frontend/.env.local (frontend strictly uses .env)');
  } catch (err) {
    console.warn('[env] Failed to remove .env.local:', err.message);
  }
}

// 2. Synchronize NEXT_PUBLIC_* from root .env to frontend/.env if root .env exists
const rootEnvPath = path.join(rootDir, '.env');
const frontendEnvPath = path.join(frontendDir, '.env');

if (fs.existsSync(rootEnvPath)) {
  const rootContent = fs.readFileSync(rootEnvPath, 'utf-8');
  const nextPublicLines = rootContent
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('NEXT_PUBLIC_'));

  if (nextPublicLines.length > 0) {
    let existingFrontendContent = '';
    if (fs.existsSync(frontendEnvPath)) {
      existingFrontendContent = fs.readFileSync(frontendEnvPath, 'utf-8');
    }

    const rootVariables = new Map();
    for (const line of nextPublicLines) {
      const trimmed = line.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        rootVariables.set(key, val);
      }
    }

    let updated = false;
    const newFrontendLines = [];

    if (fs.existsSync(frontendEnvPath)) {
      const lines = existingFrontendContent.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          if (rootVariables.has(key)) {
            const rootVal = rootVariables.get(key);
            const currentVal = trimmed.slice(eqIdx + 1).trim();
            if (currentVal !== rootVal) {
              newFrontendLines.push(`${key}=${rootVal}`);
              updated = true;
            } else {
              newFrontendLines.push(line);
            }
            rootVariables.delete(key);
            continue;
          }
        }
        newFrontendLines.push(line);
      }
    }

    // Append any root NEXT_PUBLIC_ variables that are missing from frontend/.env
    for (const [key, val] of rootVariables.entries()) {
      newFrontendLines.push(`${key}=${val}`);
      updated = true;
    }

    if (updated || !fs.existsSync(frontendEnvPath)) {
      fs.writeFileSync(frontendEnvPath, newFrontendLines.join('\n').trim() + '\n', 'utf-8');
      console.log('[env] Synchronized NEXT_PUBLIC_* from root .env to frontend/.env');
    }
  }
}
