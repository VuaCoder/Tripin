export function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { data?: { error?: { message?: string } }; message?: string };
  return err?.data?.error?.message || err?.message || fallback;
}
