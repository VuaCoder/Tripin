import { baseApi } from '@/store/api/baseApi';
import type { AddCartItemInput, Cart, CartApiResponse, CartItem, UpdateCartItemInput } from '../types';

/** The logged-in traveler's cart. All four endpoints are owner-scoped by the backend token. */
export const cartApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCart: build.query<Cart, void>({
      query: () => ({ url: '/cart' }),
      transformResponse: (response: CartApiResponse<Cart>) => response.data,
      providesTags: [{ type: 'Cart', id: 'ME' }],
    }),
    addCartItem: build.mutation<CartItem, AddCartItemInput>({
      query: (body) => ({ url: '/cart/items', method: 'POST', body }),
      transformResponse: (response: CartApiResponse<CartItem>) => response.data,
      invalidatesTags: [{ type: 'Cart', id: 'ME' }],
    }),
    updateCartItem: build.mutation<CartItem, UpdateCartItemInput>({
      query: ({ id, participants }) => ({ url: `/cart/items/${id}`, method: 'PATCH', body: { participants } }),
      transformResponse: (response: CartApiResponse<CartItem>) => response.data,
      invalidatesTags: [{ type: 'Cart', id: 'ME' }],
    }),
    removeCartItem: build.mutation<void, string>({
      query: (id) => ({ url: `/cart/items/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Cart', id: 'ME' }],
    }),
  }),
});

export const { useGetCartQuery, useAddCartItemMutation, useUpdateCartItemMutation, useRemoveCartItemMutation } = cartApi;
