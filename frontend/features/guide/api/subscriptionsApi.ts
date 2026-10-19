import { baseApi } from '@/store/api/baseApi';
import type {
  ApiResult,
  CurrentSubscription,
  GuideSubscription,
  PageResponse,
  PageResult,
  Paging,
  SubscribeResult,
  SubscriptionPlan,
} from '../types/finance';

export const subscriptionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSubscriptionPlans: build.query<SubscriptionPlan[], void>({
      query: () => '/subscriptions/plans',
      transformResponse: (response: ApiResult<SubscriptionPlan[]>) =>
        response.data,
      providesTags: [{ type: 'Subscription', id: 'PLANS' }],
    }),
    getCurrentSubscription: build.query<CurrentSubscription, void>({
      query: () => '/subscriptions/me/current',
      transformResponse: (response: ApiResult<CurrentSubscription>) =>
        response.data,
      providesTags: [{ type: 'Subscription', id: 'ME' }],
    }),
    getMySubscriptions: build.query<PageResult<GuideSubscription>, Paging>({
      query: (args) => ({
        url: '/subscriptions/me',
        params: { page: 1, limit: 10, ...args },
      }),
      transformResponse: (response: PageResponse<GuideSubscription>) => ({
        items: response.data,
        meta: response.meta,
      }),
      providesTags: [{ type: 'Subscription', id: 'ME' }],
    }),
    subscribeToPlan: build.mutation<SubscribeResult, string>({
      query: (planId) => ({
        url: '/subscriptions',
        method: 'POST',
        body: { planId },
      }),
      transformResponse: (response: ApiResult<SubscribeResult>) =>
        response.data,
      // Even a gateway failure can leave a pending subscription on the server.
      invalidatesTags: [{ type: 'Subscription', id: 'ME' }],
    }),
  }),
});

export const {
  useGetSubscriptionPlansQuery,
  useGetCurrentSubscriptionQuery,
  useGetMySubscriptionsQuery,
  useSubscribeToPlanMutation,
} = subscriptionsApi;
