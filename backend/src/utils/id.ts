import { z } from 'zod';

/** zod schema for a record id (UUID string) used in route params and body references. */
export const idSchema = z.string().uuid({ message: 'Invalid id' });

export const idParamsSchema = z.object({ id: idSchema });
export type IdParams = z.infer<typeof idParamsSchema>;
