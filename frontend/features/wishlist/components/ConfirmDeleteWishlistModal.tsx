'use client';

/* eslint-disable @next/next/no-img-element -- thumbnail preview from remote CDN */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDuration, formatVnd } from '@/lib/travel-format';
import type { WishlistItem } from '../types';

export interface ConfirmDeleteWishlistModalProps {
  isOpen: boolean;
  item: WishlistItem | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before removing a tour from the traveler's wishlist.
 */
export function ConfirmDeleteWishlistModal({
  isOpen,
  item,
  isLoading = false,
  onClose,
  onConfirm,
}: ConfirmDeleteWishlistModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen || !item || !mounted) return null;

  const tour = item.tour;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-wishlist-title"
      className="fixed inset-0 z-[9999] overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={() => {
          if (!isLoading) onClose();
        }}
        aria-hidden="true"
      />

      {/* Centering wrapper */}
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
        {/* Modal Card */}
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 text-center shadow-2xl animate-fadeInScale">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Đóng"
            className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          {/* Delete Icon */}
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-200/70 shadow-inner">
            <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
              delete
            </span>
          </div>

          {/* Header */}
          <h3 id="confirm-delete-wishlist-title" className="mt-4 text-xl font-extrabold text-slate-900">
            Xóa khỏi danh sách yêu thích?
          </h3>

          <p className="mt-1.5 text-sm text-slate-500">
            Bạn có chắc muốn bỏ lưu tour này không? Bạn vẫn có thể tìm kiếm và thêm lại bất cứ lúc nào.
          </p>

          {/* Tour snippet card */}
          <div className="mt-5 flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-left">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-200 text-slate-400">
              {tour?.coverImage ? (
                <img src={tour.coverImage} alt={tour.title} className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  travel_explore
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-bold text-slate-900">
                {tour?.title || 'Tour không còn khả dụng'}
              </h4>
              {tour && (
                <>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">
                    {tour.destination} · {formatDuration(tour.durationDays)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-primary-container">
                    Từ {formatVnd(tour.basePrice)}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:opacity-50"
            >
              Không, giữ lại
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  <span>Đang xóa...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  <span>Xác nhận xóa</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
