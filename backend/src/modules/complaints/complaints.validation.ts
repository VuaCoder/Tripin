import { z } from 'zod';
import { idParamsSchema, idSchema } from '../../utils/id';
import { COMPLAINT_TICKET_CATEGORY, COMPLAINT_TICKET_STATUS } from './complaints.types';

const CATEGORIES = Object.values(COMPLAINT_TICKET_CATEGORY) as [string, ...string[]];
const STATUSES = Object.values(COMPLAINT_TICKET_STATUS) as [string, ...string[]];

export const ticketIdParams = idParamsSchema;

export const createComplaintTicketSchema = z
  .object({
    tourId: idSchema,
    bookingId: idSchema.optional(),
    category: z.enum(CATEGORIES),
    subCategory: z.string().trim().min(2).max(100),
    subject: z.string().trim().min(5).max(200),
    description: z.string().trim().min(10).max(4000),
    imagePublicIds: z.array(z.string().trim().max(255)).max(5).optional(),
  })
  .strict();

export const sendComplaintMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
    imagePublicIds: z.array(z.string().trim().max(255)).max(5).optional(),
  })
  .strict();

export const resolveComplaintTicketSchema = z
  .object({
    solutionSummary: z.string().trim().min(10).max(2000),
  })
  .strict();

export const escalateComplaintTicketSchema = z
  .object({
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();

export const adjudicateComplaintTicketSchema = z
  .object({
    decision: z.string().trim().min(5).max(200),
    note: z.string().trim().min(10).max(2000),
  })
  .strict();

export const submitComplaintFeedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    speedScore: z.number().int().min(1).max(5).optional(),
    attitudeScore: z.number().int().min(1).max(5).optional(),
    satisfactionScore: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();

export const listComplaintsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  search: z.string().trim().max(100).optional(),
});
