'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/shared';
import { getApiErrorMessage } from '@/features/auth';
import { useGetWishlistQuery, useRemoveFromWishlistMutation } from '../api/wishlistApi';
import { WISHLIST_UI_LIMITS } from '../types';
import { WishlistItemCard } from './WishlistItemCard';
import { WishlistSkeleton } from './WishlistSkeleton';
import { ConfirmDeleteWishlistModal } from './ConfirmDeleteWishlistModal';
import type { WishlistItem } from '../types';

/** The traveler's saved tours: loading / error / empty / list states, remove, and pagination. */
export function WishlistPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, refetch } = useGetWishlistQuery({
    page,
    limit: WISHLIST_UI_LIMITS.LIST_PAGE_SIZE,
  });
  const [removeFromWishlist] = useRemoveFromWishlistMutation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<WishlistItem | null>(null);

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleRequestRemove = useCallback(
    (tourId: string) => {
      const targetItem = items.find((i) => i.tourId === tourId) ?? {
        tourId,
        addedAt: '',
        available: false,
      };
      setItemToDelete(targetItem);
    },
    [items],
  );

  const handleConfirmRemove = useCallback(
    async () => {
      if (!itemToDelete) return;
      const tourId = itemToDelete.tourId;
      setActionError(null);
      setBusyId(tourId);
      try {
        await removeFromWishlist(tourId).unwrap();
        setItemToDelete(null);
        // Removing the last card of a later page would leave an empty page: step back one.
        if (page > 1 && items.length === 1) setPage(page - 1);
      } catch (error) {
        setActionError(getApiErrorMessage(error, 'Không bỏ lưu được tour. Vui lòng thử lại.'));
      } finally {
        setBusyId(null);
      }
    },
    [itemToDelete, removeFromWishlist, page, items.length],
  );

  if (isLoading) return <WishlistSkeleton />;
  if (isError || !data) {
    return (
      <ErrorState
        title="Không tải được danh sách yêu thích"
        message="Vui lòng kiểm tra kết nối và thử lại."
        onAction={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Tour yêu thích</h1>
          <p className="mt-1 text-sm text-slate-500">
            Những tour bạn đã lưu để xem lại sau{meta && meta.total > 0 ? ` (${meta.total})` : ''}.
          </p>
        </div>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
          aria-label="Làm mới"
          title="Làm mới"
          className="flex size-9 items-center justify-center rounded-xl border border-surface-container bg-white text-slate-600 transition-colors hover:bg-surface-container-low hover:text-primary-container disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true">
            refresh
          </span>
        </button>
      </header>

      {actionError && (
        <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {actionError}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Chưa có tour yêu thích"
          description="Bấm “Lưu tour” ở trang chi tiết để lưu lại những tour bạn quan tâm."
          actionLabel="Khám phá tour"
          onAction={() => router.push('/tours')}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <WishlistItemCard
              key={item.tourId}
              item={item}
              busy={busyId === item.tourId}
              onRemove={handleRequestRemove}
            />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage(page - 1)}>
            Trước
          </Button>
          <span className="text-sm text-slate-600">
            Trang {meta.page}/{meta.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages || isFetching} onClick={() => setPage(page + 1)}>
            Sau
          </Button>
        </nav>
      )}

      <ConfirmDeleteWishlistModal
        isOpen={Boolean(itemToDelete)}
        item={itemToDelete}
        isLoading={Boolean(busyId)}
        onClose={() => {
          if (!busyId) setItemToDelete(null);
        }}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
