import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

const range = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
};
const orderedRange = (q: { from?: Date; to?: Date }) => !q.from || !q.to || q.from <= q.to;

export const listEarningsQuery = paginationQuerySchema.extend(range).refine(orderedRange, { message: 'from > to', path: ['from'] });
export const summaryQuery = z.object(range).refine(orderedRange, { message: 'from > to', path: ['from'] });

export type ListEarningsQueryInput = z.infer<typeof listEarningsQuery>;
export type SummaryQueryInput = z.infer<typeof summaryQuery>;
