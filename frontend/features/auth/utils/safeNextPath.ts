/** Accept only local navigation targets, including through the OTP step. */
export function safeNextPath(next: string | null): string | undefined {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u0020]/.test(next)) return undefined;
  return next;
}

/** Authentication screens cannot themselves be a successful login destination. */
export function authNextPath(next: string | null, fallback: string): string {
  const safe = safeNextPath(next);
  if (!safe || /^\/(?:agency\/)?(?:login|register|verify-otp|forgot-password|reset-password)(?:[/?#]|$)/.test(safe)) return fallback;
  if (/^\/workplaces\/start(?:[?#]|$)/.test(safe)) return safe.replace('/workplaces/start', '/workplaces');
  if (/^\/workplaces\/join(?:[?#]|$)/.test(safe)) {
    const target = new URL(safe, 'https://tripri.local');
    target.pathname = '/workplaces'; target.searchParams.set('join', '1');
    return target.pathname + target.search + target.hash;
  }
  return safe;
}
