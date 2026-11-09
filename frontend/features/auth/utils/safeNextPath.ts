/** Accept only local navigation targets, including through the OTP step. */
export function safeNextPath(next: string | null): string | undefined {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u0020]/.test(next)) return undefined;
  return next;
}
