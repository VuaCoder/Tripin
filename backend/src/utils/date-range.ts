import { z } from 'zod';

export interface DateRange { from: Date; to: Date }
export const dateRangeFields = { from: z.coerce.date().optional(), to: z.coerce.date().optional() };
export function validDateRange(value: { from?: Date; to?: Date }): boolean {
  return (!value.from && !value.to) || !!(value.from && value.to && value.from <= value.to);
}
