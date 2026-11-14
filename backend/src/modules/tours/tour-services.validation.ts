import { z } from 'zod';
import { MONEY_LIMITS } from '@travel-platform/constants';
const optionalServiceSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000),
  kind: z.enum(['PICKUP', 'MEAL', 'EQUIPMENT', 'OTHER']), pricing: z.enum(['PER_PERSON', 'PER_BOOKING', 'PER_UNIT']),
  unit: z.string().trim().min(1).max(30), price: z.number().int().min(0).max(MONEY_LIMITS.MAX_UNIT_PRICE),
  active: z.boolean(), cutoffHours: z.number().int().min(0).max(720), maxQuantity: z.number().int().min(1).max(100),
  ages: z.array(z.enum(['ADULT', 'CHILD', 'INFANT'])).min(1).max(3),
  pickup: z.object({ mode: z.enum(['ADDRESS', 'POINT']), area: z.string().trim().min(2).max(300),
    points: z.array(z.string().trim().min(5).max(300)).max(30), instructions: z.string().trim().max(1000) }).strict().optional(),
}).strict().superRefine((s, ctx) => {
  if (s.kind === 'PICKUP' && (s.pricing !== 'PER_PERSON' || !s.pickup || (s.pickup.mode === 'POINT' && !s.pickup.points.length)))
    ctx.addIssue({ code: 'custom', message: 'Đưa đón phải tính theo người và có khu vực/điểm đón.', path: ['pickup'] });
  if (s.kind !== 'PICKUP' && s.pickup) ctx.addIssue({ code: 'custom', message: 'Chỉ đưa đón được cấu hình địa chỉ.', path: ['pickup'] });
});
export const optionalServicesSchema = z.array(optionalServiceSchema).max(20)
  .refine(s => new Set(s.map(x => x.id)).size === s.length, 'Mã dịch vụ bị trùng')
  .refine(s => new Set(s.map(x => x.name.trim().toLowerCase())).size === s.length, 'Tên dịch vụ bị trùng lặp. Mỗi dịch vụ chỉ được thêm một lần.');
const extraSelectionSchema = z.object({
  serviceId: z.string().uuid(), terms: z.string().min(1).max(15000), passengerIds: z.array(z.string().uuid()).max(50),
  quantity: z.number().int().min(1).max(100),
  pickups: z.array(z.object({ passengerId: z.string().uuid(), address: z.string().trim().min(5).max(300) }).strict()).max(50),
}).strict();
export const extraSelectionsSchema = z.array(extraSelectionSchema).max(20);
