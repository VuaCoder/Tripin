import { baseApi } from '@/store/api/baseApi';
import type { Booking, BookingApiResponse, CreateBookingInput } from '../types';

/** Booking step reached from the cart. `POST /bookings` re-prices and reserves seats server-side. */
export const bookingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createBooking: build.mutation<Booking, CreateBookingInput>({
      query: (body) => ({ url: '/bookings', method: 'POST', body }),
      transformResponse: (response: BookingApiResponse<Booking>) => response.data,
    }),
  }),
});

export const { useCreateBookingMutation } = bookingApi;
