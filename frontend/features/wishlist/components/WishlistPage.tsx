'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/shared';
import { getApiErrorMessage } from '@/features/auth';
import { useGetWishlistQuery, useRemoveFromWishlistMutation } from '../api/wishlistApi';
import { WISHLIST_UI_LIMITS } from '../types';
import { WishlistItemCard } from './WishlistItemCard';
import { WishlistSkeleton } from './WishlistSkeleton';
import { WishlistButton } from './WishlistButton';
import { ConfirmDeleteWishlistModal } from './ConfirmDeleteWishlistModal';
import { ConfirmDeleteCollectionModal } from './ConfirmDeleteCollectionModal';
import { CollageImageGrid } from './CollageImageGrid';
import { IncompleteBookingBanner } from '@/features/booking';
import {
  getWishlistCollections,
  deleteWishlistCollection,
  removeTourFromCollection,
  type WishlistCollection,
} from '../utils/wishlistCollections';
import {
  getRecentlyViewedRecords,
  removeRecentlyViewedTour,
  groupRecentToursByMilestone,
  type RecentlyViewedTourRecord,
} from '@/features/tours';
import { formatVnd } from '@/lib/travel-format';
import type { WishlistItem } from '../types';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80';

export function WishlistPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Collections state
  const [collections, setCollections] = useState<WishlistCollection[]>([]);
  const [recentRecords, setRecentRecords] = useState<RecentlyViewedTourRecord[]>([]);
  const [isEditingRecent, setIsEditingRecent] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<WishlistCollection | null>(null);

  // Tour deletion state
  const [itemToDelete, setItemToDelete] = useState<WishlistItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Backend wishlist query
  const { data, isLoading, isFetching, isError, refetch } = useGetWishlistQuery({
    page: 1,
    limit: WISHLIST_UI_LIMITS.PAGE_SIZE,
  });
  const [removeFromWishlist] = useRemoveFromWishlistMutation();

  const items = data?.items ?? [];

  const loadData = useCallback(() => {
    const cols = getWishlistCollections();
    // Sync default collection with backend items if needed
    if (cols.length === 1 && cols[0].id === 'default' && cols[0].tourIds.length === 0 && items.length > 0) {
      cols[0].tourIds = items.map((i) => i.tourId);
    }
    setCollections(cols);
    setRecentRecords(getRecentlyViewedRecords());
  }, [items]);

  useEffect(() => {
    setMounted(true);
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('wishlist-collections-updated', handleUpdate);
    window.addEventListener('recent-tours-updated', handleUpdate);
    return () => {
      window.removeEventListener('wishlist-collections-updated', handleUpdate);
      window.removeEventListener('recent-tours-updated', handleUpdate);
    };
  }, [loadData]);

  const handleConfirmDeleteCollection = () => {
    if (!collectionToDelete) return;
    deleteWishlistCollection(collectionToDelete.id);
    setCollectionToDelete(null);
    loadData();
  };

  const handleRequestRemoveTour = useCallback(
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

  const handleConfirmRemoveTour = useCallback(async () => {
    if (!itemToDelete) return;
    const tourId = itemToDelete.tourId;
    setActionError(null);
    setBusyId(tourId);
    try {
      await removeFromWishlist(tourId).unwrap();
      if (selectedCollectionId && selectedCollectionId !== '__recent__') {
        removeTourFromCollection(selectedCollectionId, tourId);
      }
      setItemToDelete(null);
      loadData();
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, 'Không bỏ lưu được tour. Vui lòng thử lại.'),
      );
    } finally {
      setBusyId(null);
    }
  }, [itemToDelete, removeFromWishlist, selectedCollectionId, loadData]);

  if (!mounted || isLoading) return <WishlistSkeleton />;

  if (isError || !data) {
    return (
      <ErrorState
        title="Không tải được danh sách yêu thích"
        message="Vui lòng kiểm tra kết nối và thử lại."
        onAction={() => void refetch()}
      />
    );
  }

  const isViewingRecent = selectedCollectionId === '__recent__';
  const activeCollection = collections.find((c) => c.id === selectedCollectionId);
  const recentMilestoneGroups = groupRecentToursByMilestone(recentRecords);

  // Tours inside active custom collection
  const activeTours = activeCollection
    ? activeCollection.tourIds
        .map((id) => items.find((i) => i.tourId === id))
        .filter(Boolean) as WishlistItem[]
    : [];

  return (
    <div className="flex flex-col pb-12">
      {/* BANNER 1: INCOMPLETE BOOKING BANNER (Image 4) */}
      <IncompleteBookingBanner />

      {/* ========================================================================= */}
      {/* 1. MAIN VIEW: WISHLIST COLLECTIONS GRID (Images 1 & 2)                    */}
      {/* ========================================================================= */}
      {selectedCollectionId === null ? (
        <div>
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Yêu thích
            </h1>
            <button
              type="button"
              disabled={isFetching}
              onClick={() => {
                void refetch();
                loadData();
              }}
              aria-label="Làm mới"
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {/* FOLDER 1: "ĐÃ XEM GẦN ĐÂY" (SYSTEM FOLDER, CANNOT BE DELETED) */}
            <div
              onClick={() => setSelectedCollectionId('__recent__')}
              className="group flex flex-col cursor-pointer select-none"
            >
              <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 shadow-xs border border-slate-200/80">
                <CollageImageGrid
                  images={recentRecords.map((r) => r.tour.coverImage)}
                  altTitle="Đã xem gần đây"
                />
              </div>
              <div className="pt-3">
                <h3 className="font-bold text-base text-slate-900 group-hover:text-primary-container transition-colors">
                  Đã xem gần đây
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {recentRecords.length > 0 ? `${recentRecords.length} tour đã xem` : 'Chưa có lịch sử xem'}
                </p>
              </div>
            </div>

            {/* FOLDERS 2+: CUSTOM COLLECTIONS (e.g. "ok") */}
            {collections.map((col) => {
              const colImages = col.tourIds
                .map((id) => items.find((i) => i.tourId === id)?.tour?.coverImage)
                .filter(Boolean) as string[];

              return (
                <div
                  key={col.id}
                  onClick={() => setSelectedCollectionId(col.id)}
                  className="group relative flex flex-col cursor-pointer select-none"
                >
                  <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 shadow-xs border border-slate-200/80">
                    <CollageImageGrid
                      images={colImages}
                      altTitle={col.name}
                    />

                    {/* Top-Left 'X' Delete Button on Hover */}
                    <button
                      type="button"
                      aria-label={`Xóa danh sách ${col.name}`}
                      title={`Xóa danh sách ${col.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollectionToDelete(col);
                      }}
                      className="absolute top-3.5 left-3.5 z-20 size-9 rounded-full bg-white text-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>

                  <div className="pt-3">
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-primary-container transition-colors">
                      {col.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Đã lưu {col.tourIds.length} mục
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : isViewingRecent ? (
        /* ========================================================================= */
        /* 2. RECENTLY VIEWED DETAIL VIEW (Images 2 & 3)                             */
        /* ========================================================================= */
        <div>
          {/* Top navigation row */}
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setSelectedCollectionId(null);
                setIsEditingRecent(false);
              }}
              className="flex size-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Quay lại danh sách yêu thích"
            >
              <span className="material-symbols-outlined text-[24px]">chevron_left</span>
            </button>

            {/* "Chỉnh sửa" / "Xong" toggle button in top-right */}
            {recentRecords.length > 0 && (
              <button
                type="button"
                onClick={() => setIsEditingRecent(!isEditingRecent)}
                className="text-sm font-semibold text-slate-900 underline hover:text-black cursor-pointer py-1 px-2"
              >
                {isEditingRecent ? 'Xong' : 'Chỉnh sửa'}
              </button>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
            Đã xem gần đây
          </h1>

          {recentRecords.length === 0 ? (
            <EmptyState
              title="Chưa có tour đã xem gần đây"
              description="Các tour bạn đã khám phá sẽ xuất hiện tại đây."
              actionLabel="Khám phá ngay"
              onAction={() => router.push('/tours')}
            />
          ) : (
            <div className="space-y-10">
              {recentMilestoneGroups.map((group) => (
                <section key={group.dateLabel}>
                  {/* Milestone Header (e.g. "Chủ Nhật, 1 tháng 11" - Image 2) */}
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4">
                    {group.dateLabel}
                  </h2>

                  {/* Responsive 4-column Grid (Image 3 - Max 4 per row) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {group.records.map(({ tour }) => (
                      <div
                        key={tour.id}
                        onClick={() => router.push(`/tours/${tour.id}`)}
                        className="group flex flex-col cursor-pointer select-none"
                      >
                        {/* Image Card Container */}
                        <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-100 shadow-xs border border-slate-200/60">
                          <img
                            src={tour.coverImage || DEFAULT_COVER}
                            alt={tour.title}
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.currentTarget.src = DEFAULT_COVER;
                            }}
                          />

                          {/* Heart Button Top-Right (translucent frame, red heart on saved) */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-2 right-2 z-10"
                          >
                            <WishlistButton
                              tourId={tour.id}
                              tourTitle={tour.title}
                              tourCoverImage={tour.coverImage}
                            />
                          </div>

                          {/* Delete button in Edit mode Top-Left */}
                          {isEditingRecent && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecentlyViewedTour(tour.id);
                                loadData();
                              }}
                              aria-label={`Xóa ${tour.title} khỏi lịch sử xem`}
                              className="absolute top-2.5 left-2.5 z-20 size-8 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-md hover:shadow-lg transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          )}
                        </div>

                        {/* Details under card (Images 2 & 3) */}
                        <div className="pt-2.5">
                          <h3 className="font-semibold text-sm text-slate-900 truncate group-hover:text-primary-container transition-colors">
                            {tour.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {tour.durationDays ? `${tour.durationDays} ngày` : '1 tour'} · ★{' '}
                            {tour.ratingAvg ? tour.ratingAvg.toFixed(1) : '5.0'}
                          </p>
                          {tour.basePrice > 0 && (
                            <p className="text-xs font-semibold text-slate-900 mt-1">
                              {formatVnd(tour.basePrice)}
                              <span className="font-normal text-slate-500"> / khách</span>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. CUSTOM COLLECTION DETAIL VIEW                                          */
        /* ========================================================================= */
        <div>
          <header className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedCollectionId(null)}
                className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
                aria-label="Quay lại danh sách yêu thích"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {activeCollection?.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeTours.length} tour trong mục này
                </p>
              </div>
            </div>
          </header>

          {actionError && (
            <p role="alert" className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {actionError}
            </p>
          )}

          {activeTours.length === 0 ? (
            <EmptyState
              title="Chưa có tour nào trong mục này"
              description="Hãy bấm vào nút tim khi khám phá tour để lưu vào danh sách yêu thích."
              actionLabel="Khám phá tour"
              onAction={() => router.push('/tours')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {activeTours.map((item) => {
                const tour = item.tour;
                if (!tour) return null;
                return (
                  <div
                    key={item.tourId}
                    onClick={() => router.push(`/tours/${item.tourId}`)}
                    className="group flex flex-col cursor-pointer select-none"
                  >
                    {/* Image Card Container */}
                    <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-100 shadow-xs border border-slate-200/60">
                      <img
                        src={tour.coverImage || DEFAULT_COVER}
                        alt={tour.title}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_COVER;
                        }}
                      />

                      {/* Remove tour from this collection button Top-Right */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 right-2 z-10"
                      >
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveTour(item.tourId)}
                          disabled={busyId === item.tourId}
                          aria-label={`Xóa ${tour.title} khỏi danh mục`}
                          title="Bỏ tour khỏi danh mục này"
                          className="flex size-8 items-center justify-center rounded-full bg-white/90 text-slate-700 hover:bg-white hover:text-red-600 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    </div>

                    {/* Tour details */}
                    <div className="pt-2.5">
                      <h3 className="font-semibold text-sm text-slate-900 truncate group-hover:text-primary-container transition-colors">
                        {tour.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {tour.durationDays ? `${tour.durationDays} ngày` : '1 tour'} · ★{' '}
                        {tour.ratingAvg ? tour.ratingAvg.toFixed(1) : '5.0'}
                      </p>
                      {tour.basePrice > 0 && (
                        <p className="text-xs font-semibold text-slate-900 mt-1">
                          {formatVnd(tour.basePrice)}
                          <span className="font-normal text-slate-500"> / khách</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* POPUP CONFIRM DELETE COLLECTION */}
      <ConfirmDeleteCollectionModal
        isOpen={Boolean(collectionToDelete)}
        collectionName={collectionToDelete?.name ?? ''}
        onClose={() => setCollectionToDelete(null)}
        onConfirm={handleConfirmDeleteCollection}
      />

      {/* POPUP CONFIRM DELETE INDIVIDUAL TOUR */}
      <ConfirmDeleteWishlistModal
        isOpen={Boolean(itemToDelete)}
        item={itemToDelete}
        isLoading={Boolean(busyId)}
        onClose={() => {
          if (!busyId) setItemToDelete(null);
        }}
        onConfirm={handleConfirmRemoveTour}
      />
    </div>
  );
}
