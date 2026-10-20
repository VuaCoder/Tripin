import { z } from 'zod';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';
import { REPORT_CATEGORY, REPORT_STATUS, REPORT_TARGET } from './reports.types';

const status = z.enum(Object.values(REPORT_STATUS) as [string, ...string[]]);

export const createReportBody = z
  .object({
    targetType: z.enum(Object.values(REPORT_TARGET) as [string, ...string[]]),
    targetId: idSchema,
    category: z.enum(Object.values(REPORT_CATEGORY) as [string, ...string[]]),
    description: z.string().trim().min(10, 'Please describe the problem (at least 10 characters)').max(2000),
    bookingId: idSchema.optional(),
  })
  .strict();

export const listReportsQuery = paginationQuerySchema.extend({ status: status.optional() });

export const respondBody = z.object({ text: z.string().trim().min(5).max(2000) }).strict();

export const resolveReportBody = z
  .object({ decision: z.enum([REPORT_STATUS.RESOLVED, REPORT_STATUS.REJECTED]), note: z.string().trim().min(3).max(2000) })
  .strict();

export const reportIdParams = idParamsSchema;

/** An agency dispute names no target: the review is in the path and the server checks it owns it. */
export const disputeReviewBody = createReportBody.omit({ targetType: true, targetId: true, bookingId: true });

export const reviewIdParams = z.object({ reviewId: idSchema });

export type CreateReportBody = z.infer<typeof createReportBody>;
export type DisputeReviewBody = z.infer<typeof disputeReviewBody>;
export type ReviewIdParams = z.infer<typeof reviewIdParams>;
export type ListReportsQueryInput = z.infer<typeof listReportsQuery>;
export type RespondBody = z.infer<typeof respondBody>;
export type ResolveReportBody = z.infer<typeof resolveReportBody>;
