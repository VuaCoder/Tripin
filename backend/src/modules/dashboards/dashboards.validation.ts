import { z } from 'zod';
import { dateRangeFields, validDateRange } from '../../utils/date-range';

export const adminDashboardQuery = z.object(dateRangeFields)
  .refine(validDateRange, 'Provide both from and to, with from <= to')
  .refine(({ from, to }) => !from || !to || to.getTime() - from.getTime() < 366 * 86400000, 'Select at most 366 days');
export type AdminDashboardQuery = z.infer<typeof adminDashboardQuery>;
