import { z } from 'zod';
import { POLICY_KEYS } from './system-settings.types';

export const commissionBody = z
  .object({
    ratePercent: z
      .number()
      .min(0)
      .max(100)
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, 'At most 2 decimals'),
  })
  .strict();

export const policyKeyParams = z.object({ key: z.enum(POLICY_KEYS) });

export const policyBody = z
  .object({
    title: z.string().trim().min(2).max(200),
    content: z.string().max(50_000),
    params: z
      .record(z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,59}$/), z.union([z.number().finite(), z.string().max(500), z.boolean()]))
      .refine((record) => Object.keys(record).length <= 30, 'Too many params')
      .optional(),
  })
  .strict();

export type CommissionBody = z.infer<typeof commissionBody>;
export type PolicyKeyParams = z.infer<typeof policyKeyParams>;
export type PolicyBody = z.infer<typeof policyBody>;
