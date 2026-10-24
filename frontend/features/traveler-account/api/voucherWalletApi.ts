import { baseApi } from '@/store/api/baseApi';
import type { DiscountType, PromotionApplyType, PromotionCodeType, PromotionScope } from '@travel-platform/constants';

export interface PromotionDto {
  id: string;
  scope: PromotionScope;
  ownerId?: string;
  applyType: PromotionApplyType;
  codeType: PromotionCodeType;
  code?: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  minParticipants?: number;
  daysInAdvance?: number;
  firstBookingOnly: boolean;
  targetTourIds: string[];
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  usageLimitPerUser: number;
  usedCount: number;
  isActive: boolean;
  isRunning: boolean;
}

export interface UserVoucherItem {
  id: string;
  userId: string;
  promotionId: string;
  collectedAt: string;
  isUsed: boolean;
  usedAt?: string;
  bookingId?: string;
  promotion?: PromotionDto;
}

export interface FreeTimeSlot {
  id: string;
  name: string;
  start: string;
  end: string;
  enabled: boolean;
}

export interface UserPreferencesDto {
  freeTimeSlots: FreeTimeSlot[];
  voucherExpiryAlerts: boolean;
  emailAlerts: boolean;
}

export const voucherWalletApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyVouchers: builder.query<{ success: boolean; data: UserVoucherItem[] }, void>({
      query: () => '/promotions/my-vouchers',
      providesTags: ['Promotion'],
    }),

    collectVoucher: builder.mutation<
      { success: boolean; data: UserVoucherItem },
      { promotionId?: string; code?: string }
    >({
      query: (body) => ({
        url: '/promotions/collect',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Promotion'],
    }),

    getUserPreferences: builder.query<{ success: boolean; data: UserPreferencesDto }, void>({
      query: () => '/users/me/preferences',
      providesTags: ['User'],
    }),

    updateUserPreferences: builder.mutation<
      { success: boolean; data: UserPreferencesDto },
      Partial<UserPreferencesDto>
    >({
      query: (body) => ({
        url: '/users/me/preferences',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['User'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMyVouchersQuery,
  useCollectVoucherMutation,
  useGetUserPreferencesQuery,
  useUpdateUserPreferencesMutation,
} = voucherWalletApi;
