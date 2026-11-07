'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SaveToWishlistModal } from './SaveToWishlistModal';

export interface WishlistToastPayload {
  tourId: string;
  tourTitle?: string;
  tourCoverImage?: string;
  collectionName: string;
  collectionId: string;
  action?: 'saved' | 'removed';
}

const TOAST_EVENT = 'tripri-wishlist-toast';
const HIDE_EVENT = 'tripri-wishlist-toast-hide';

export function showWishlistToast(payload: WishlistToastPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
}

export function hideWishlistToast(tourId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HIDE_EVENT, { detail: { tourId } }));
}

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80';

export function WishlistToast() {
  const [toast, setToast] = useState<WishlistToastPayload | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Auto-dismiss after 3 seconds whenever a toast is shown
  useEffect(() => {
    if (!toast) return;

    timerRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [toast]);

  // Window event listeners registered once
  useEffect(() => {
    const handleShow = (e: Event) => {
      const custom = e as CustomEvent<WishlistToastPayload>;
      if (custom.detail) {
        setToast(custom.detail);
      }
    };

    const handleHide = (e: Event) => {
      const custom = e as CustomEvent<{ tourId?: string }>;
      if (!custom.detail?.tourId || toastRef.current?.tourId === custom.detail.tourId) {
        setToast(null);
      }
    };

    window.addEventListener(TOAST_EVENT, handleShow);
    window.addEventListener(HIDE_EVENT, handleHide);

    return () => {
      window.removeEventListener(TOAST_EVENT, handleShow);
      window.removeEventListener(HIDE_EVENT, handleHide);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  if (!toast && !isModalOpen) return null;

  return (
    <>
      {toast && (
        <aside
          role="status"
          aria-live="polite"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-2xl animate-fadeInScale transition-all max-w-[92vw] sm:max-w-md select-none"
        >
          {/* Thumbnail */}
          <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
            <img
              src={toast.tourCoverImage || DEFAULT_COVER}
              alt={toast.tourTitle || 'Tour'}
              className="size-full object-cover"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_COVER;
              }}
            />
          </div>

          {/* Text: Đã lưu vào **[Tên]** or Đã xoá khỏi **[Tên]** */}
          <div className="flex-1 min-w-0 text-sm text-slate-800">
            <span>{toast.action === 'removed' ? 'Đã xoá khỏi ' : 'Đã lưu vào '}</span>
            <strong className="font-bold text-slate-900 truncate inline-block max-w-[130px] sm:max-w-[170px] align-bottom">
              {toast.collectionName}
            </strong>
          </div>

          {/* Underlined "Thay đổi" button - only when saved */}
          {toast.action !== 'removed' && (
            <button
              type="button"
              onClick={() => {
                if (timerRef.current) clearTimeout(timerRef.current);
                setIsModalOpen(true);
              }}
              className="shrink-0 cursor-pointer text-sm font-semibold text-slate-900 underline hover:text-black ml-2 py-1"
            >
              Thay đổi
            </button>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              setToast(null);
            }}
            className="shrink-0 ml-1 flex size-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </aside>
      )}

      {/* Change Collection Modal */}
      {isModalOpen && toast && (
        <SaveToWishlistModal
          isOpen={isModalOpen}
          tourId={toast.tourId}
          tourTitle={toast.tourTitle}
          tourCoverImage={toast.tourCoverImage}
          onClose={() => {
            setIsModalOpen(false);
            handleMouseLeave();
          }}
          onSavedChange={(saved) => {
            if (!saved) {
              setToast(null);
            }
          }}
        />
      )}
    </>
  );
}

