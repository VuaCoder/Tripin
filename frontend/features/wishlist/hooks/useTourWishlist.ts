'use client';

import { useCallback, useState } from 'react';
import { getApiErrorMessage, selectAuthStatus, selectIsAuthenticated, selectRole } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { useAddToWishlistMutation, useGetWishlistTourIdsQuery, useRemoveFromWishlistMutation } from '../api/wishlistApi';

export type TourWishlistStatus = 'loading' | 'guest' | 'not-traveler' | 'error' | 'ready';

export interface TourWishlist {
  status: TourWishlistStatus;
  isSaved: boolean;
  /** An add/remove request is in flight. */
  pending: boolean;
  /** Message of the last failed toggle, cleared on the next attempt. */
  error: string | null;
  toggle: () => Promise<void>;
  retry: () => void;
}

/**
 * Saved-state + toggle for one tour (Tour Detail heart button). Only a logged-in TRAVELER queries the wishlist;
 * guests and other roles never hit `/wishlist` (the backend would answer 401/403).
 */
export function useTourWishlist(tourId: string): TourWishlist {
  const authStatus = useAppSelector(selectAuthStatus);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);
  const isTraveler = isAuthenticated && role === 'TRAVELER';

  const idsQuery = useGetWishlistTourIdsQuery(undefined, { skip: !isTraveler });
  const [add, addState] = useAddToWishlistMutation();
  const [remove, removeState] = useRemoveFromWishlistMutation();
  const [error, setError] = useState<string | null>(null);

  const isSaved = idsQuery.data?.includes(tourId) ?? false;
  const { refetch } = idsQuery;

  const toggle = useCallback(async () => {
    setError(null);
    try {
      if (isSaved) await remove(tourId).unwrap();
      else await add(tourId).unwrap();
    } catch (err) {
      setError(
        getApiErrorMessage(err, isSaved ? 'Không bỏ lưu được tour. Vui lòng thử lại.' : 'Không lưu được tour. Vui lòng thử lại.'),
      );
    }
  }, [add, remove, isSaved, tourId]);

  let status: TourWishlistStatus = 'ready';
  if (authStatus === 'idle') status = 'loading';
  else if (!isAuthenticated) status = 'guest';
  else if (role !== 'TRAVELER') status = 'not-traveler';
  else if (idsQuery.isError) status = 'error';
  else if (idsQuery.isLoading) status = 'loading';

  return {
    status,
    isSaved,
    pending: addState.isLoading || removeState.isLoading,
    error,
    toggle,
    retry: () => void refetch(),
  };
}
