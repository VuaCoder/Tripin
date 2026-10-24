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
        website: z.url().max(300),
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
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

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
    extraPermissions: z.array(z.enum(Object.values(PERMISSIONS) as [string, ...string[]])).max(100).optional(),
  })
  .strict()
  .refine((value) => value.role !== undefined || value.extraPermissions !== undefined, 'role or extraPermissions is required');

export const updatePreferencesBody = z
  .object({
    freeTimeSlots: z
      .array(
        z.object({
          id: z.string().trim().max(50),
          name: z.string().trim().max(100),
          start: z.string().trim().regex(/^\d{1,2}:\d{2}$/, 'Invalid time format HH:mm'),
          end: z.string().trim().regex(/^\d{1,2}:\d{2}$/, 'Invalid time format HH:mm'),
          enabled: z.boolean(),
        }),
      )
      .max(10)
      .optional(),
    voucherExpiryAlerts: z.boolean().optional(),
    emailAlerts: z.boolean().optional(),
  })
  .strict();

export type UpdateProfileBody = z.infer<typeof updateProfileBody>;
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBody>;
export type CompleteImageUploadBody = z.infer<typeof completeImageUploadBody>;
export type ListUsersQueryInput = z.infer<typeof listUsersQuery>;
export type AssignAccessBody = z.infer<typeof assignAccessBody>;

