import { z } from 'zod';
import { idSchema } from '../../utils/id';
import { paginationQuerySchema } from '../../utils/pagination';

export const wishlistTourParams = z.object({ tourId: idSchema });
export const listWishlistQuery = paginationQuerySchema;

export type WishlistTourParams = z.infer<typeof wishlistTourParams>;
export type ListWishlistQueryInput = z.infer<typeof listWishlistQuery>;
