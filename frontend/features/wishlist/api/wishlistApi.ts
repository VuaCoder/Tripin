import { baseApi } from '@/store/api/baseApi';
import {
  WISHLIST_UI_LIMITS,
  type WishlistApiResponse,
  type WishlistItem,
  type WishlistListArgs,
  type WishlistPageData,
  type WishlistSavedResult,
} from '../types';

/** The logged-in traveler's wishlist. Every endpoint is owner-scoped by the backend token. */
export const wishlistApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** `GET /wishlist` — one page of saved tours, newest first. Unavailable tours stay in with `available:false`. */
    getWishlist: build.query<WishlistPageData, WishlistListArgs | void>({
      query: (args) => ({ url: '/wishlist', params: { page: 1, limit: WISHLIST_UI_LIMITS.LIST_PAGE_SIZE, ...(args ?? {}) } }),
      transformResponse: (response: WishlistApiResponse<WishlistItem[]>) => ({
        items: response.data,
        meta: response.meta ?? { page: 1, limit: response.data.length, total: response.data.length, totalPages: 1 },
      }),
      providesTags: [{ type: 'Wishlist', id: 'ME' }],
    }),

    /**
     * Every saved tour id, used to show the saved state on Tour Detail. The backend has no "is this tour saved"
     * endpoint, so this walks the list (cap 200 = 2 pages of 100) and returns just the ids.
     */
    getWishlistTourIds: build.query<string[], void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const ids: string[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const result = await baseQuery({ url: '/wishlist', params: { page, limit: WISHLIST_UI_LIMITS.PAGE_SIZE } });
          if (result.error) return { error: result.error };
          const body = result.data as WishlistApiResponse<WishlistItem[]>;
          ids.push(...body.data.map((item) => item.tourId));
          totalPages = body.meta?.totalPages ?? 1;
          page += 1;
        } while (page <= totalPages);
        return { data: ids };
      },
      providesTags: [{ type: 'Wishlist', id: 'ME' }],
    }),

    /** `POST /wishlist/:tourId` — idempotent (201 when new, 200 when already saved). */
    addToWishlist: build.mutation<WishlistSavedResult, string>({
      query: (tourId) => ({ url: `/wishlist/${tourId}`, method: 'POST' }),
      transformResponse: (response: WishlistApiResponse<WishlistSavedResult>) => response.data,
      invalidatesTags: [{ type: 'Wishlist', id: 'ME' }],
    }),

    /** `DELETE /wishlist/:tourId` — 204 whether or not it was saved. */
    removeFromWishlist: build.mutation<void, string>({
      query: (tourId) => ({ url: `/wishlist/${tourId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Wishlist', id: 'ME' }],
    }),
  }),
});

export const {
  useGetWishlistQuery,
  useGetWishlistTourIdsQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation,
} = wishlistApi;
