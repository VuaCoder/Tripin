import { baseApi } from '@/store/api/baseApi';

export interface PremiumStatus {
  active: boolean;
  endsAt: string | null;
  expired: boolean;
}
export interface PremiumPlan {
  id: string;
  code: string;
  name: string;
  description?: string;
  audience: string;
  price: number;
  durationDays: number;
  version: number;
  benefits: string[];
  published?: boolean;
  vouchers?: {
    quantity: number;
    title: string;
    tourIds: string[];
    discountType: string;
    discountValue: number;
    maxDiscountAmount?: number;
    minOrderAmount: number;
  }[];
}
export interface PremiumPeriod {
  planId?: string;
  createdAt?: string;
  id: string;
  planName: string;
  price: number;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  revokedAt: string | null;
  premiumRefund?: { status: string } | null;
}
export interface VoucherTerms {
  title: string;
  agencyId: string;
  tourIds: string[];
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
}
export interface PremiumVoucher {
  id: string;
  terms: VoucherTerms;
  startsAt: string;
  endsAt: string;
  heldAt: string | null;
  bookingId: string | null;
}
export interface GuidePremiumProfile {
  introduction: string;
  portfolio: {
    title: string;
    description: string;
    imageUrl?: string;
    url?: string;
  }[];
  certificates: {
    name: string;
    issuer: string;
    issuedAt: string;
    documentUrl?: string;
  }[];
}
const unwrap = <T>(response: { data: T }) => response.data;
export const premiumApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    myPremium: build.query<PremiumStatus, string>({
      query: () => '/premium/me',
      transformResponse: unwrap<PremiumStatus>,
      providesTags: ['Subscription'],
    }),
    premiumPlans: build.query<PremiumPlan[], string>({
      query: (audience) => ({ url: '/premium/plans', params: { audience } }),
      transformResponse: unwrap<PremiumPlan[]>,
      providesTags: ['Subscription'],
    }),
    premiumHistory: build.query<
      { items: PremiumPeriod[]; meta: { page: number; totalPages: number } },
      { userId: string; page: number }
    >({
      query: (args) => ({
        url: '/premium/me/history',
        params: { page: args.page, limit: 20 },
      }),
      transformResponse: (response: {
        data: PremiumPeriod[];
        meta: { page: number; totalPages: number };
      }) => ({ items: response.data, meta: response.meta }),
      providesTags: ['Subscription'],
    }),
    premiumPeriod: build.query<PremiumPeriod, { userId: string; id: string }>({
      query: (args) => `/premium/subscriptions/${args.id}`,
      transformResponse: unwrap<PremiumPeriod>,
      providesTags: ['Subscription'],
    }),
    premiumVouchers: build.query<PremiumVoucher[], string>({
      query: () => '/premium/me/vouchers',
      transformResponse: unwrap<PremiumVoucher[]>,
      providesTags: ['Subscription'],
    }),
    premiumSubscribe: build.mutation<
      { checkout: { checkoutUrl: string } },
      string
    >({
      query: (planId) => ({
        url: '/premium/subscribe',
        method: 'POST',
        body: { planId },
      }),
      transformResponse: unwrap<{ checkout: { checkoutUrl: string } }>,
      invalidatesTags: ['Subscription'],
    }),
    premiumMutation: build.mutation<
      unknown,
      { url: string; method?: string; body?: unknown }
    >({
      query: ({ url, method = 'POST', body }) => ({ url, method, body }),
      invalidatesTags: ['Subscription'],
    }),
    premiumResource: build.query<unknown, string>({
      query: (url) => url,
      transformResponse: unwrap<unknown>,
      providesTags: ['Subscription'],
    }),
    publicGuidePremium: build.query<
      { active: boolean; profile: GuidePremiumProfile | null },
      string
    >({
      query: (id) => `/premium/guides/${id}`,
      transformResponse: unwrap<{
        active: boolean;
        profile: GuidePremiumProfile | null;
      }>,
      keepUnusedDataFor: 30,
    }),
  }),
});
export const {
  useMyPremiumQuery,
  usePremiumPlansQuery,
  usePremiumHistoryQuery,
  usePremiumPeriodQuery,
  usePremiumVouchersQuery,
  usePremiumSubscribeMutation,
  usePremiumMutationMutation,
  usePremiumResourceQuery,
  usePublicGuidePremiumQuery,
} = premiumApi;
