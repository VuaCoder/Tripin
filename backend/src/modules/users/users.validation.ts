import { dateRangeFields, validDateRange } from '../../utils/date-range';
import { z } from 'zod';
import { PERMISSIONS, PERSISTED_ROLES, USER_STATUS } from '@travel-platform/constants';
import { idSchema, idParamsSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';

const trimmed = (max: number) => z.string().trim().max(max);
const phone = z.string().trim().regex(/^\+?[0-9 ().-]{6,20}$/, 'Invalid phone number');
const imageUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((val) => val.startsWith('http://') || val.startsWith('https://'), 'URL must start with http:// or https://')
  .nullable();
const bankAccount = z
  .object({
    bankName: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().regex(/^\d{6,32}$/, 'Invalid account number'),
    accountHolder: z.string().trim().min(2).max(120),
  })
  .strict()
  .nullable();

export const updateProfileBody = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone: phone.nullable(),
    avatarUrl: imageUrl,
    agencyProfile: z
      .object({
        companyName: z.string().trim().min(2).max(200),
        description: trimmed(5000),
        address: trimmed(500),
        website: z.union([z.literal(''), z.url().max(300)]).nullable().transform((value) => value || null),
        licenseNumber: z.string().trim().min(3).max(100),
      })
      .partial()
      .strict(),
    guideProfile: z
      .object({
        bio: trimmed(5000),
        languages: z.array(z.string().trim().min(2).max(40)).max(20),
        specialties: z.array(z.string().trim().min(2).max(60)).max(30),
        experienceYears: z.number().int().min(0).max(80),
        licenseNumber: z.string().trim().min(3).max(100),
        licenseImageUrl: imageUrl,
      })
      .partial()
      .strict(),
    bankAccount,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const guideApplicationBody = z.object({
  licenseNumber: z.string().trim().min(3).max(100),
  experienceYears: z.number().int().min(0).max(80).optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  specialties: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  bio: z.string().trim().max(5000).optional(),
  licenseImageUrl: z.url().max(500).optional(),
}).strict();
export const guideRejectionBody = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();

export const publicProfileParams = idParamsSchema;
export const listAgencyGuidesQuery = paginationQuerySchema.extend({ q: z.string().trim().max(120).optional() });

/** The signature endpoints deliberately accept no client-controlled upload parameters. */
export const imageSignatureBody = z.object({}).strict();

export const completeImageUploadBody = z
  .object({
    publicId: z.string().trim().min(1).max(300),
  })
  .strict();

export const listUsersQuery = paginationQuerySchema.extend({
  ...dateRangeFields,
  role: z.enum(PERSISTED_ROLES).optional(),
  status: z.enum(Object.values(USER_STATUS) as [string, ...string[]]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
}).refine(validDateRange, 'Provide both from and to, with from <= to');

export const assignAccessParams = z.object({ id: idSchema });

export const assignAccessBody = z
  .object({
    role: z.enum(PERSISTED_ROLES).optional(),
    revokedPermissions: z.array(z.enum(Object.values(PERMISSIONS) as [string, ...string[]])).max(100).optional(),
    extraPermissions: z.array(z.enum(Object.values(PERMISSIONS) as [string, ...string[]])).max(100).optional(),
  })
  .strict()
  .refine((value) => value.role !== undefined || value.extraPermissions !== undefined || value.revokedPermissions !== undefined, 'role or extraPermissions is required');

export const updatePreferencesBody = z
  .object({
    freeTimeSlots: z
      .array(
        z.object({
          id: z.string().trim().max(50),
          name: z.string().trim().max(100),
          start: z.string().trim().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm (00:00–23:59)'),
          end: z.string().trim().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm (00:00–23:59)'),
          enabled: z.boolean(),
        }),
      )
      .max(10)
      .optional(),
    voucherExpiryAlerts: z.boolean().optional(),
    emailAlerts: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const slots = value.freeTimeSlots ?? [];
    for (const [index, slot] of slots.entries()) {
      if (slot.start >= slot.end) {
        ctx.addIssue({ code: 'custom', path: ['freeTimeSlots', index, 'end'], message: 'End time must be after start time' });
      }
      if (!slot.enabled) continue;
      for (let previous = 0; previous < index; previous += 1) {
        const other = slots[previous]!;
        if (other.enabled && slot.start < other.end && other.start < slot.end) {
          ctx.addIssue({ code: 'custom', path: ['freeTimeSlots', index, 'start'], message: 'Enabled time slots must not overlap' });
          break;
        }
      }
    }
  });

export type UpdateProfileBody = z.infer<typeof updateProfileBody>;
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBody>;
export type CompleteImageUploadBody = z.infer<typeof completeImageUploadBody>;
export type ListUsersQueryInput = z.infer<typeof listUsersQuery>;
export type AssignAccessBody = z.infer<typeof assignAccessBody>;

