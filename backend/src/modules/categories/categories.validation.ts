import { z } from 'zod';
import { idParamsSchema } from '../../utils/id';

const name = z.string().trim().min(2).max(80);
const description = z.string().trim().max(1000);
const sortOrder = z.number().int().min(0).max(100_000);

export const createCategoryBody = z.object({ name, description: description.optional(), sortOrder: sortOrder.optional() }).strict();

export const updateCategoryBody = z
  .object({ name: name.optional(), description: description.optional(), sortOrder: sortOrder.optional(), isActive: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const categoryIdParams = idParamsSchema;

export type CreateCategoryBody = z.infer<typeof createCategoryBody>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBody>;
