import { z } from 'zod';
import { idSchema } from '../../utils/id';
export const completionParams = z.object({ tourId: idSchema, departureId: idSchema });
export const reportBody = z.object({
  expectedRevision: z.number().int().nonnegative(),
  actualEndAt: z.iso.datetime({ offset: true }).nullable().optional(),
  actualParticipants: z.number().int().nonnegative().optional(),
  actualGuests: z.object({ adults: z.number().int().nonnegative(), children: z.number().int().nonnegative(), infants: z.number().int().nonnegative() }).strict().optional(),
  summary: z.string().trim().max(10000),
  noChanges: z.boolean().optional(),
  noIncidents: z.boolean().optional(),
  serviceConfirmations: z.array(z.object({ key: z.string().length(64), status: z.enum(['UNCONFIRMED', 'PROVIDED', 'NOT_PROVIDED', 'PARTIALLY_PROVIDED']) }).strict()).max(5000).optional(),
  services: z.object({
    transport: z.enum(['UNCONFIRMED', 'PROVIDED', 'NOT_PROVIDED', 'NOT_APPLICABLE']),
    guide: z.enum(['UNCONFIRMED', 'PROVIDED', 'NOT_PROVIDED', 'NOT_APPLICABLE']),
    entranceTickets: z.enum(['UNCONFIRMED', 'PROVIDED', 'NOT_PROVIDED', 'NOT_APPLICABLE']),
  }).strict().optional(),
  absenceReason: z.string().trim().max(10000).optional(),
  additionalNotes: z.string().trim().max(10000).optional(),
  changes: z.string().trim().max(10000),
  incidents: z.string().trim().max(10000),
  attendance: z.array(z.object({ bookingId: idSchema, attendedCount: z.number().int().nonnegative() }).strict()).max(5000),
  evidence: z.array(z.string().url().max(2048).refine(v => v.startsWith('https://'), 'Minh chứng phải dùng HTTPS')).max(20),
  amendmentReason: z.string().trim().max(2000).default(''),
}).strict().refine(input => input.actualParticipants === undefined || input.attendance.length === 0,
  'Chỉ nhập tổng khách thực tế hoặc số khách theo booking, không nhập cả hai.')
  .refine(input => !input.actualGuests || input.actualParticipants === input.actualGuests.adults + input.actualGuests.children + input.actualGuests.infants,
    'Tổng khách thực tế phải bằng tổng người lớn, trẻ em và em bé.');
export type CompletionReportInput = z.infer<typeof reportBody>;
