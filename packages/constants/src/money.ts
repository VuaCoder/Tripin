/** Whole VND. Storage capacity and business limits are deliberately separate. */
export const MONEY_LIMITS = {
  MAX_UNIT_PRICE: 1_000_000_000,
  MAX_BOOKING_AMOUNT: 50_000_000_000,
  MAX_PROMOTION_AMOUNT: 50_000_000_000,
  MAX_GUIDE_FEE: 100_000_000_000,
} as const;

export function assertVnd(value: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError('Amount exceeds supported whole VND range');
  }
  return value;
}

/** Never silently round a persisted value or an aggregate at the JSON boundary. */
export function safeVndNumber(value: bigint | number | string): number {
  if (typeof value === 'number') return assertVnd(value);
  const exact = BigInt(value);
  if (exact < BigInt(0) || exact > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Amount exceeds safe JSON number range');
  }
  return Number(exact);
}

export function sumVnd(values: readonly number[]): number {
  return safeVndNumber(values.reduce((sum, value) => sum + BigInt(assertVnd(value)), BigInt(0)));
}

/** Existing rules: discounts/commission floor; age unit prices round half up. */
export function ratioVnd(amount: number, numerator: number, denominator: number, rounding: 'floor' | 'round' = 'floor'): number {
  assertVnd(amount);
  assertVnd(numerator);
  assertVnd(denominator);
  if (denominator === 0) throw new RangeError('Money ratio denominator must be positive');
  const product = BigInt(amount) * BigInt(numerator);
  const divisor = BigInt(denominator);
  return safeVndNumber((product + (rounding === 'round' ? divisor / BigInt(2) : BigInt(0))) / divisor);
}
