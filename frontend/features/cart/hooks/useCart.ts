'use client';

import { useGetCartQuery } from '../api/cartApi';
import type { CartItem, CartTotals } from '../types';

const NO_ITEMS: CartItem[] = [];

export interface UseCartResult {
  items: CartItem[];
  availableItems: CartItem[];
  unavailableItems: CartItem[];
  totals?: CartTotals;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

/** Thin wrapper over `GET /cart` that also derives the bookable / unavailable split used by the UI. */
export function useCart(): UseCartResult {
  const { data, isLoading, isFetching, isError, refetch } = useGetCartQuery();
  const items = data?.items ?? NO_ITEMS;

  return {
    items,
    availableItems: items.filter((item) => item.available),
    unavailableItems: items.filter((item) => !item.available),
    totals: data?.totals,
    isLoading,
    isFetching,
    isError,
    refetch: () => void refetch(),
  };
}
