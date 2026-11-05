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
 * Saved-state + toggle for one tour with Optimistic UI.
 * Instantly updates heart icon on click; rolls back if network request fails.
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

  // Optimistic UI state
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);

  const serverSaved = idsQuery.data?.includes(tourId) ?? false;
  // If user just toggled, use optimisticSaved immediately; otherwise fallback to server data
  const isSaved = optimisticSaved !== null ? optimisticSaved : serverSaved;

  const { refetch } = idsQuery;

  const toggle = useCallback(async () => {
    setError(null);
    const targetSaved = !isSaved;
    // 1. Optimistic immediate update (0ms UI feedback)
    setOptimisticSaved(targetSaved);

    try {
      if (!targetSaved) {
        await remove(tourId).unwrap();
      } else {
        await add(tourId).unwrap();
      }
      // On success, reset optimistic state to let cache take over
      setOptimisticSaved(null);
    } catch (err) {
      // Rollback on error
      setOptimisticSaved(null);
      setError(
        getApiErrorMessage(
          err,
          !targetSaved
            ? 'Không bỏ lưu được tour. Vui lòng thử lại.'
            : 'Không lưu được tour. Vui lòng thử lại.',
        ),
      );
    }
  }, [add, remove, isSaved, tourId]);

  let status: TourWishlistStatus = 'ready';
  if (authStatus === 'idle') status = 'loading';
  else if (!isAuthenticated) status = 'guest';
  else if (role !== 'TRAVELER') status = 'not-traveler';
  else if (idsQuery.isError) status = 'error';
  else if (idsQuery.isLoading && optimisticSaved === null) status = 'loading';

  return {
    status,
    isSaved,
    pending: addState.isLoading || removeState.isLoading,
    error,
    toggle,
    retry: () => void refetch(),
  };
}
