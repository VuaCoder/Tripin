import { z } from 'zod';
import { AGENCY_VERIFICATION_STATUS, TOUR_STATUS } from '@travel-platform/constants';
import { idParamsSchema, objectIdSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';
import { REPORT_CATEGORY, REPORT_STATUS, REPORT_TARGET } from '../reports';
import { REVIEW_STATUS } from '../reviews';
import { TICKET_CATEGORY, TICKET_STATUS } from '../support';

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as [string, ...string[]];
const reason = z.string().trim().min(3).max(1000);

export const idParams = idParamsSchema;

// ---- tours
export const listToursQuery = paginationQuerySchema.extend({
  status: z.enum(values(TOUR_STATUS)).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  agencyId: objectIdSchema.optional(),
});
export const validateTourBody = z
  .object({ approve: z.boolean(), reason: reason.optional() })
  .strict()
  .refine((v) => v.approve || Boolean(v.reason), { message: 'reason is required to reject', path: ['reason'] });
export const suspendTourBody = z.object({ reason }).strict();

// ---- agencies
export const listAgenciesQuery = paginationQuerySchema.extend({
  status: z.enum(values(AGENCY_VERIFICATION_STATUS)).default(AGENCY_VERIFICATION_STATUS.PENDING),
});
export const verifyAgencyBody = z
  .object({ approve: z.boolean(), note: z.string().trim().min(3).max(1000).optional() })
  .strict()
  .refine((v) => v.approve || Boolean(v.note), { message: 'note is required to reject', path: ['note'] });

// ---- reviews
export const listReviewsQuery = paginationQuerySchema.extend({
  status: z.enum(values(REVIEW_STATUS)).optional(),
  tourId: objectIdSchema.optional(),
});
export const moderateReviewBody = z
  .object({ hide: z.boolean(), reason: reason.optional() })
  .strict()
  .refine((v) => !v.hide || Boolean(v.reason), { message: 'reason is required when hiding', path: ['reason'] });

// ---- accounts
export const banBody = z.object({ reason }).strict();

// ---- reports
export const listReportsQuery = paginationQuerySchema.extend({
  status: z.enum(values(REPORT_STATUS)).optional(),
  targetType: z.enum(values(REPORT_TARGET)).optional(),
  category: z.enum(values(REPORT_CATEGORY)).optional(),
});
export const resolveReportBody = z
  .object({ decision: z.enum([REPORT_STATUS.RESOLVED, REPORT_STATUS.REJECTED]), note: z.string().trim().min(3).max(2000) })
  .strict();

// ---- support tickets
export const listTicketsQuery = paginationQuerySchema.extend({
  status: z.enum(values(TICKET_STATUS)).optional(),
  category: z.enum(values(TICKET_CATEGORY)).optional(),
});
export const ticketReplyBody = z.object({ text: z.string().trim().min(2).max(4000), resolve: z.boolean().optional() }).strict();
export const ticketStatusBody = z.object({ status: z.enum([TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.RESOLVED]) }).strict();

export type ListToursQueryInput = z.infer<typeof listToursQuery>;
export type ValidateTourBody = z.infer<typeof validateTourBody>;
export type SuspendTourBody = z.infer<typeof suspendTourBody>;
export type ListAgenciesQueryInput = z.infer<typeof listAgenciesQuery>;
export type VerifyAgencyBody = z.infer<typeof verifyAgencyBody>;
export type ListReviewsQueryInput = z.infer<typeof listReviewsQuery>;
export type ModerateReviewBody = z.infer<typeof moderateReviewBody>;
export type BanBody = z.infer<typeof banBody>;
export type ListReportsQueryInput = z.infer<typeof listReportsQuery>;
export type ResolveReportBody = z.infer<typeof resolveReportBody>;
export type ListTicketsQueryInput = z.infer<typeof listTicketsQuery>;
export type TicketReplyBody = z.infer<typeof ticketReplyBody>;
export type TicketStatusBody = z.infer<typeof ticketStatusBody>;
