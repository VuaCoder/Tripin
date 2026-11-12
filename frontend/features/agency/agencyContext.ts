'use client';

import { baseApi } from '@/store/api/baseApi';
import { selectActiveAgency, selectUser, setAgencyMemberships } from '@/features/auth/store/authSlice';
import type { AgencyMembership } from '@/features/auth/types';
import { useAppSelector } from '@/store/hooks';

export const agencyContextApi = baseApi.injectEndpoints({
  endpoints: build => ({
    agencyMemberships: build.query<AgencyMembership[], void>({
      query: () => '/users/me/agencies',
      transformResponse: (response: { data: AgencyMembership[] }) => response.data,
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        const userId = (getState() as import('@/store').RootState).auth.user?.id;
        try {
          const { data } = await queryFulfilled;
          if (userId) dispatch(setAgencyMemberships({ userId, agencies: data }));
        } catch { /* The shell exposes retry without discarding personal access. */ }
      },
    }),
  }),
});

export const { useAgencyMembershipsQuery } = agencyContextApi;

export function useAgencyContext() {
  const agency = useAppSelector(selectActiveAgency);
  const user = useAppSelector(selectUser);
  return agency && user ? { ...agency, actorUserId: user.id } : null;
}
