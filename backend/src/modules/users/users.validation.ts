import { z } from 'zod';
import { PERMISSIONS, PERSISTED_ROLES, USER_STATUS } from '@travel-platform/constants';
import { idSchema, idParamsSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';

const trimmed = (max: number) => z.string().trim().max(max);
const phone = z.string().trim().regex(/^\+?[0-9 ().-]{6,20}$/, 'Invalid phone number');

export const updateProfileBody = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone,
    avatarUrl: z.url().max(500),
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
      })
      .partial()
      .strict(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const publicProfileParams = idParamsSchema;

export const listUsersQuery = paginationQuerySchema.extend({
  role: z.enum(PERSISTED_ROLES).optional(),
  status: z.enum(Object.values(USER_STATUS) as [string, ...string[]]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const assignAccessParams = z.object({ id: idSchema });

export const assignAccessBody = z
  .object({
    role: z.enum(PERSISTED_ROLES).optional(),
    extraPermissions: z.array(z.enum(Object.values(PERMISSIONS) as [string, ...string[]])).max(100).optional(),
  })
  .strict()
  .refine((value) => value.role !== undefined || value.extraPermissions !== undefined, 'role or extraPermissions is required');

export type UpdateProfileBody = z.infer<typeof updateProfileBody>;
export type ListUsersQueryInput = z.infer<typeof listUsersQuery>;
export type AssignAccessBody = z.infer<typeof assignAccessBody>;
