import { z } from 'zod';

const instant = z.string().datetime({ offset: true }).max(50).transform((value) => new Date(value));
const idSchema = z.string().uuid().max(36);
const capacity = z.number().int().min(1).max(10_000);
const price = z.number().int().min(0).max(2_000_000_000).nullable();
export const calendarQuery = z.object({ from: instant, to: instant, tourId: idSchema.optional() }).strict()
  .refine(({ from, to }) => to > from && to.getTime() - from.getTime() <= 93 * 86_400_000, 'Khoảng lịch phải từ 1 đến 93 ngày.');
export const calendarTourParams = z.object({ tourId: idSchema }).strict();
export const calendarDepartureParams = calendarTourParams.extend({ departureId: idSchema });
const departureItem = z.object({
  id: idSchema,
  date: instant,
  capacity: capacity.optional(),
  priceOverride: price.optional(),
  isOpen: z.boolean().optional(),
}).strict();
export const createDeparturesBody = z.object({
  departures: z.array(departureItem).min(1).max(200),
}).strict().refine(({ departures }) => new Set(departures.map((item) => item.id)).size === departures.length, 'Mã đợt khởi hành bị trùng.');
export const updateDepartureBody = z.object({ expectedDate: instant, date: instant.optional(), capacity: capacity.optional(), priceOverride: price.optional(), isOpen: z.boolean().optional() }).strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'expectedDate'), 'Chưa có thay đổi.');
export const deleteDepartureBody = z.object({ expectedDate: instant }).strict();

export type CalendarQuery = z.infer<typeof calendarQuery>;
export type CreateDeparture = z.infer<typeof createDeparturesBody>['departures'][number];
export type UpdateDeparture = z.infer<typeof updateDepartureBody>;
