import { safeVndNumber } from '@travel-platform/constants';

type NumericValue<T> = T extends bigint ? number : T;
/** Repository records keep the existing number-based service/API contract. */
export type NumericRecord<T> = { [K in keyof T]: NumericValue<T[K]> };

/** Explicit, shallow repository mapping; relations must be mapped separately. */
export function numericRecord<T extends object>(row: T): NumericRecord<T> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key, typeof value === 'bigint' ? safeVndNumber(value) : value,
  ])) as NumericRecord<T>;
}
