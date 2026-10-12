import { baseApi } from '@/store/api/baseApi';
import type { CheckoutDto, PaymentApiResponse, PaymentDto } from '../types/payment.types';

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    checkoutBooking: build.mutation<CheckoutDto, string>({
      query: (bookingId) => ({
        url: `/payments/bookings/${bookingId}/checkout`,
        method: 'POST',
      }),
      transformResponse: (response: PaymentApiResponse<CheckoutDto>) => response.data,
      invalidatesTags: ['Payment', 'Booking', 'Cart'],
    }),

    getPayment: build.query<PaymentDto, string>({
      query: (paymentId) => ({
        url: `/payments/${paymentId}`,
        method: 'GET',
      }),
      transformResponse: (response: PaymentApiResponse<PaymentDto>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Payment', id }],
    }),
  }),
});

export const { useCheckoutBookingMutation, useGetPaymentQuery } = paymentApi;
