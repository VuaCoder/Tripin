import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontendDir = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const mode = process.argv[2] || 'preview';
if (!['build', 'start', 'preview'].includes(mode)) {
  console.error('Usage: node frontend/scripts/preview.mjs [build|start|preview]');
  process.exit(1);
}
const port = process.env.TRIPRI_PREVIEW_PORT || '3100';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error('TRIPRI_PREVIEW_PORT must be a port between 1 and 65535.');
  process.exit(1);
}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextCli, ...args], {
      cwd: frontendDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production', TRIPRI_PREVIEW: '1' },
    });
    const stop = () => child.kill();
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    const cleanup = () => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
    };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('exit', code => { cleanup(); resolve(code ?? 1); });
  });
}
console.log('Preview source:', path.resolve(frontendDir, '..'));
console.log('Build directory: .next-preview (development .next is preserved)');
try {
  if (mode !== 'start') {
    const code = await run(['build']);
    if (code !== 0) process.exit(code);
  }
  if (mode !== 'build') {
    console.log('Local preview: http://localhost:' + port);
    process.exitCode = await run(['start', '-H', '127.0.0.1', '-p', port]);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
