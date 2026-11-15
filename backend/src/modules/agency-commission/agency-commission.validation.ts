import { z } from 'zod';

const sharePercent = z.number().min(0).max(50);

export const createCommissionRequestBody = z.object({
  requestedSharePercent: sharePercent,
  reason: z.string().trim().min(1).max(1000),
}).strict();

export const approveCommissionRequestBody = z.object({
  note: z.string().trim().max(1000).optional(),
}).strict();

export const rejectCommissionRequestBody = z.object({
  note: z.string().trim().min(1).max(1000),
}).strict();

export const commissionRequestIdParams = z.object({ id: z.string().uuid().max(36) });

export const listCommissionRequestsQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateCommissionRequestBody = z.infer<typeof createCommissionRequestBody>;
export type ApproveCommissionRequestBody = z.infer<typeof approveCommissionRequestBody>;
export type RejectCommissionRequestBody = z.infer<typeof rejectCommissionRequestBody>;
export type ListCommissionRequestsQueryInput = z.infer<typeof listCommissionRequestsQuery>;
