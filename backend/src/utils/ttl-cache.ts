/**
 * Tiny in-process cache for expensive read models (dashboards). Concurrent requests for the same key share one
 * computation. Per node only; fine for numbers that may be a few seconds old.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { expiresAt: number; value: Promise<T> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns the cached value, or runs `compute` once and caches its result. A failed computation is not cached. */
  getOrCompute(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;

    if (this.entries.size >= this.maxEntries) this.evictExpired();
    if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value as string);

    const value = compute();
    this.entries.set(key, { expiresAt: this.now() + this.ttlMs, value });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    return value;
  }

  clear(): void {
    this.entries.clear();
  }

  private evictExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(key);
  }
}
