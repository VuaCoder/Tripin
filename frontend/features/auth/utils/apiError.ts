export function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { data?: { error?: { message?: string } }; message?: string };
  return err?.data?.error?.message || err?.message || fallback;
}

/** Reads the machine-readable `error.code` the backend returns (e.g. `EMAIL_ALREADY_REGISTERED`). */
export function getApiErrorCode(error: unknown): string | undefined {
  const err = error as { data?: { error?: { code?: string } } };
  return err?.data?.error?.code;
}
