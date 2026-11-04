import { z } from 'zod';

const id = z.string().uuid().length(36);
const httpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine((value) => value.startsWith('https://'), 'Cần liên kết HTTPS');
export const contributionBody = z
  .object({
    acceptedTerms: z.literal(true),
    title: z.string().trim().min(3).max(160),
    tourIds: z.array(id).min(1).max(100),
    discountType: z.enum(['PERCENT', 'FIXED']),
    discountValue: z.number().int().positive().max(2_000_000_000),
    maxDiscountAmount: z
      .number()
      .int()
      .positive()
      .max(2_000_000_000)
      .optional(),
    minOrderAmount: z.number().int().min(0).max(2_000_000_000),
    capacity: z.number().int().positive().max(1_000_000),
  })
  .strict()
  .refine(
    (v) =>
      v.discountType !== 'PERCENT' ||
      (v.discountValue <= 100 && !!v.maxDiscountAmount),
    'Giảm phần trăm cần mức trần và không vượt 100%',
  );
export const planBody = z
  .object({
    code: z.string().regex(/^[A-Z0-9_-]{3,40}$/),
    name: z.string().trim().min(3).max(120),
    description: z.string().max(2000).optional(),
    audience: z.enum(['TRAVELER', 'TOUR_GUIDE']),
    price: z.number().int().positive().max(2_000_000_000),
    durationDays: z.number().int().min(1).max(366),
    version: z.number().int().positive(),
    benefits: z.array(z.string().trim().min(1).max(300)).min(1).max(20),
    vouchers: z
      .array(
        z
          .object({
            contributionId: id,
            quantity: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .refine(
    (v) => v.audience !== 'TRAVELER' || v.vouchers.length > 0,
    'Premium Traveler cần bộ voucher',
  )
  .refine(
    (v) => v.audience !== 'TOUR_GUIDE' || v.vouchers.length === 0,
    'Gói Guide không cấp voucher đặt tour',
  )
  .refine(
    (v) =>
      new Set(v.vouchers.map((x) => x.contributionId)).size ===
      v.vouchers.length,
    'Không lặp nguồn voucher',
  )
  .refine(
    (v) => v.vouchers.reduce((total, item) => total + item.quantity, 0) <= 500,
    'Mỗi kỳ tối đa 500 voucher',
  );
export const guideProfileBody = z
  .object({
    introduction: z.string().trim().max(3000),
    portfolio: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(160),
            description: z.string().max(1000),
            imageUrl: httpsUrl.optional(),
            url: httpsUrl.optional(),
          })
          .strict(),
      )
      .max(20),
    certificates: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(160),
            issuer: z.string().trim().min(1).max(160),
            issuedAt: z.string().date().length(10),
            documentUrl: httpsUrl.optional(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export const refundBody = z
  .object({ reason: z.string().trim().min(5).max(1000) })
  .strict();
export const decisionBody = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'COMPLETE']),
    note: z.string().trim().min(3).max(1000),
    transferReference: z.string().trim().min(3).max(200).optional(),
  })
  .strict()
  .refine(
    (v) => v.action !== 'COMPLETE' || !!v.transferReference,
    'Cần mã tham chiếu chuyển tiền',
  );
export type ContributionInput = z.infer<typeof contributionBody>;
export type PlanInput = z.infer<typeof planBody>;
export type GuideProfileInput = z.infer<typeof guideProfileBody>;
