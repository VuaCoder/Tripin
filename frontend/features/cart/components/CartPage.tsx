'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { getApiErrorMessage } from '@/features/auth';
import { useRemoveCartItemMutation, useUpdateCartItemMutation } from '../api/cartApi';
import { useCart } from '../hooks';
import type { CartItem } from '../types';
import { AddTourPanel } from './AddTourPanel';
import { CartItemCard } from './CartItemCard';
import { CartSummary } from './CartSummary';

/** The booking handoff: the cart passes the selection to the booking step, which calls `POST /bookings`. */
export function bookingHref(item: CartItem): string {
  const params = new URLSearchParams({
    tourId: item.tourId,
    departureId: item.departureId,
    participants: String(item.participants),
    cartItemId: item.id,
  });
  return `/traveler/bookings/new?${params.toString()}`;
}

/** The traveler's cart: loading / error / empty / list states, update + remove, backend-computed totals. */
export function CartPage() {
  const router = useRouter();
  const { items, availableItems, totals, isLoading, isFetching, isError, refetch } = useCart();
  const [updateCartItem] = useUpdateCartItemMutation();
  const [removeCartItem] = useRemoveCartItemMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Only the line being changed is disabled: a slow mutation must not freeze the rest of the cart.
  const [busyId, setBusyId] = useState<string | null>(null);
  const busy = busyId !== null;

  const goToBooking = useCallback((item: CartItem) => router.push(bookingHref(item)), [router]);

  const handleUpdate = useCallback(
    async (id: string, participants: number) => {
      setActionError(null);
      setBusyId(id);
      try {
        await updateCartItem({ id, participants }).unwrap();
      } catch (error) {
        setActionError(getApiErrorMessage(error, 'Không cập nhật được số khách. Vui lòng thử lại.'));
      } finally {
        setBusyId(null);
      }
    },
    [updateCartItem],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      setActionError(null);
      setBusyId(id);
      try {
        await removeCartItem(id).unwrap();
      } catch (error) {
        setActionError(getApiErrorMessage(error, 'Không xóa được tour khỏi giỏ. Vui lòng thử lại.'));
      } finally {
        setBusyId(null);
      }
    },
    [removeCartItem],
  );

  if (isLoading) return <LoadingState label="Đang tải giỏ hàng..." />;
  if (isError || !totals) return <ErrorState title="Không tải được giỏ hàng" message="Vui lòng kiểm tra kết nối và thử lại." onAction={refetch} />;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Giỏ hàng của bạn</h1>
          <p className="mt-1 text-sm text-slate-500">
            Lưu các tour bạn đang cân nhắc, sau đó tiếp tục sang bước đặt chỗ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add_shopping_cart</span>
            Thêm tour
          </Button>
          <Button variant="outline" size="sm" loading={isFetching} onClick={refetch}>
            Làm mới
          </Button>
        </div>
      </header>

      <AddTourPanel open={addOpen} onToggle={setAddOpen} />

      {actionError && (
        <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {actionError}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Giỏ hàng đang trống"
          description="Bạn chưa lưu tour nào. Hãy chọn một tour đang mở bán và thêm vào giỏ để đặt chỗ sau."
          actionLabel="Thêm tour vào giỏ"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <CartItemCard
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onUpdateParticipants={handleUpdate}
                onRemove={handleRemove}
                onContinue={goToBooking}
              />
            ))}
          </div>
          <CartSummary totals={totals} firstAvailable={availableItems[0]} busy={busy} onContinue={goToBooking} />
        </div>
      )}
    </div>
  );
}
