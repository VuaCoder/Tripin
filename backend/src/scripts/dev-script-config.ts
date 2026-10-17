/** Configuration for explicitly invoked local tools; never imported by the application server. */
export function assertDevScriptEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production') throw new Error('Dev scripts cannot run in production.');
}

export function requireDevPassword(name: 'DEV_FIXTURE_PASSWORD' | 'DEV_POSTGRES_PASSWORD', env: NodeJS.ProcessEnv = process.env): string {
  const password = env[name];
  if (!password || !password.trim()) throw new Error(`Set ${name} in your local environment before running this dev script.`);
  return password;
}

export function assertLocalDatabaseUrl(value: string | undefined): void {
  let parsed: URL;
  try { parsed = new URL(value ?? ''); }
  catch { throw new Error('Dev fixture requires a valid local DATABASE_URL.'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Dev fixture only runs against a local PostgreSQL database.');
  }
}
