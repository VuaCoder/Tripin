'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  getWishlistCollections,
  createWishlistCollection,
  addTourToCollection,
  type WishlistCollection,
} from '../utils/wishlistCollections';
import { CollageImageGrid } from './CollageImageGrid';

export interface SaveToWishlistModalProps {
  isOpen: boolean;
  tourId: string;
  tourTitle?: string;
  tourCoverImage?: string;
  onClose: () => void;
  onSavedChange?: (isSaved: boolean) => void;
  onSyncBackend?: (tourId: string) => void | Promise<void>;
}

export function SaveToWishlistModal({
  isOpen,
  tourId,
  tourTitle,
  tourCoverImage,
  onClose,
  onSavedChange,
  onSyncBackend,
}: SaveToWishlistModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'select' | 'create'>('select');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [collections, setCollections] = useState<WishlistCollection[]>([]);

  const loadCollections = () => {
    const list = getWishlistCollections();
    setCollections(list);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadCollections();
      setStep('select');
      setNewCollectionName('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleSelectCollection = (collection: WishlistCollection) => {
    addTourToCollection(collection.id, tourId);
    if (onSyncBackend) {
      void onSyncBackend(tourId);
    }
    // Update floating toast to reflect this newly selected collection
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tripri-wishlist-toast', {
          detail: {
            tourId,
            tourTitle: tourTitle || 'Tour',
            tourCoverImage,
            collectionName: collection.name,
            collectionId: collection.id,
          },
        }),
      );
    }
    loadCollections();
    onSavedChange?.(true);
    onClose();
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    const newCol = createWishlistCollection(newCollectionName.trim(), tourId);
    if (onSyncBackend) {
      void onSyncBackend(tourId);
    }
    // Update floating toast to reflect the newly created collection
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tripri-wishlist-toast', {
          detail: {
            tourId,
            tourTitle: tourTitle || 'Tour',
            tourCoverImage,
            collectionName: newCol.name,
            collectionId: newCol.id,
          },
        }),
      );
    }
    onSavedChange?.(true);
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centering wrapper */}
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        {/* Modal Card */}
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 text-left shadow-2xl animate-fadeInScale">
          {/* Top-Right Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute top-5 right-5 flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          {/* STEP 1: SELECT COLLECTION (Image 3) */}
          {step === 'select' ? (
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-8">
                Lưu vào danh sách yêu thích
              </h3>

              {/* Collections List */}
              <div className="my-6 max-h-80 overflow-y-auto space-y-3 pr-1">
                {collections.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    Chưa có danh sách yêu thích nào.
                  </p>
                ) : (
                  collections.map((col) => {
                    const isTourSaved = col.tourIds.includes(tourId);
                    return (
                      <div
                        key={col.id}
                        onClick={() => handleSelectCollection(col)}
                        className={`flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${
                          isTourSaved
                            ? 'border-brand-teal bg-teal-50/40 shadow-xs'
                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="size-16 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                          <CollageImageGrid
                            images={
                              isTourSaved && tourCoverImage
                                ? [tourCoverImage]
                                : []
                            }
                            altTitle={col.name}
                            className="size-full !rounded-xl"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate">
                            {col.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Đã lưu {col.tourIds.length} mục
                          </p>
                        </div>
                        {isTourSaved && (
                          <span className="material-symbols-outlined text-brand-teal text-[22px]">
                            check_circle
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Button: Tạo danh sách mong muốn mới (Image 3) */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep('create')}
                  className="w-full py-3.5 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
                >
                  Tạo danh sách mong muốn mới
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: CREATE COLLECTION (Image 5) */
            <form onSubmit={handleCreateCollection}>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-8">
                Tạo Danh sách yêu thích
              </h3>

              <div className="my-6">
                <div className="relative rounded-2xl border border-slate-300 focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 p-3 transition-all">
                  <label className="block text-[11px] font-medium text-slate-500">
                    Tên
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Ví dụ: Kỳ nghỉ hè, Tour Phú Quốc..."
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none pt-1"
                    autoFocus
                  />
                </div>
                <div className="mt-1.5 text-right text-xs text-slate-400">
                  {newCollectionName.length}/50 ký tự
                </div>
              </div>

              {/* Bottom Actions (Image 5) */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="px-4 py-2 text-sm font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newCollectionName.trim()}
                  className="px-6 py-2.5 rounded-2xl text-sm font-bold bg-[#087e8b] hover:bg-[#00636e] text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Tạo
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
