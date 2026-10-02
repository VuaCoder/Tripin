import { z } from 'zod';
import { idParamsSchema, idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';
import { SUPPORT_LIMITS, TICKET_CATEGORY, TICKET_STATUS } from './support.types';

const text = z.string().trim().min(2).max(SUPPORT_LIMITS.MAX_TEXT_LENGTH);
const status = z.enum(Object.values(TICKET_STATUS) as [string, ...string[]]);
const category = z.enum(Object.values(TICKET_CATEGORY) as [string, ...string[]]);

export const createTicketBody = z
  .object({
    subject: z.string().trim().min(5).max(200),
    category,
    message: text.min(10),
    bookingId: idSchema.optional(),
  })
  .strict();

export const replyBody = z.object({ text }).strict();
export const listTicketsQuery = paginationQuerySchema.extend({ status: status.optional() });
export const ticketIdParams = idParamsSchema;


export type CreateTicketBody = z.infer<typeof createTicketBody>;
export type ReplyBody = z.infer<typeof replyBody>;
export type ListTicketsQueryInput = z.infer<typeof listTicketsQuery>;
