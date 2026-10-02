import { z } from 'zod';
import { objectIdSchema } from '../../utils/object-id';
import { paginationQuerySchema } from '../../utils/pagination';

export const wishlistTourParams = z.object({ tourId: objectIdSchema });
export const listWishlistQuery = paginationQuerySchema;

export type WishlistTourParams = z.infer<typeof wishlistTourParams>;
export type ListWishlistQueryInput = z.infer<typeof listWishlistQuery>;
