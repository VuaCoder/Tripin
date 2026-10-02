import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

/** zod schema for a Mongo ObjectId string (route params, body references). */
export const objectIdSchema = z.string().refine((value) => isValidObjectId(value) && value.length === 24, {
  message: 'Invalid id',
});

export const idParamsSchema = z.object({ id: objectIdSchema });
export type IdParams = z.infer<typeof idParamsSchema>;
