/**
 * Case-insensitive "contains" filter built from untrusted text.
 * The value is always sent as a bound parameter (no SQL injection), but PostgreSQL still reads `%` and `_` inside it
 * as LIKE wildcards (and `\` as the escape character), so all three are escaped: a search for "50%" finds "50%",
 * it does not match everything.
 */
export function containsText(value: string) {
  return { contains: value.trim().replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const };
}
