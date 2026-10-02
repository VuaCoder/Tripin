/** Escapes user text before it is used inside a MongoDB `$regex` (prevents regex injection / ReDoS patterns). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" matcher built from untrusted text. */
export function containsRegex(value: string): RegExp {
  return new RegExp(escapeRegex(value.trim()), 'i');
}
