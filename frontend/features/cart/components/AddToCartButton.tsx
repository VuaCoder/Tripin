'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { getApiErrorMessage } from '@/features/auth';
import { useAddCartItemMutation } from '../api/cartApi';

export interface AddToCartButtonProps {
  tourId: string;
  departureId: string;
  /** Head-count chosen on the tour detail screen. */
  participants: number;
  disabled?: boolean;
  className?: string;
  onAdded?: () => void;
}

/**
 * "Add tour to cart" for the tour detail screen. The tour/departure/head-count come from the page; the backend
 * re-checks that the tour is public and the departure bookable, so an invalid selection surfaces its error here.
 */
export function AddToCartButton({ tourId, departureId, participants, disabled = false, className, onAdded }: AddToCartButtonProps) {
  const [addCartItem, { isLoading }] = useAddCartItemMutation();
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleAdd = async () => {
    setStatus('idle');
    setMessage(null);
    try {
      await addCartItem({ tourId, departureId, participants }).unwrap();
      setStatus('success');
      onAdded?.();
    } catch (error) {
      setStatus('error');
      setMessage(getApiErrorMessage(error, 'Không thêm được tour vào giỏ hàng. Vui lòng thử lại.'));
    }
  };

  return (
    <div className={className}>
      <Button onClick={handleAdd} loading={isLoading} disabled={disabled}>
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add_shopping_cart</span>
        Thêm vào giỏ
      </Button>
      {status === 'success' && (
        <p role="status" className="mt-2 text-xs font-medium text-emerald-700">
          Đã thêm vào giỏ.{' '}
          <Link href="/traveler/cart" className="underline">
            Xem giỏ hàng
          </Link>
        </p>
      )}
      {status === 'error' && message && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}
