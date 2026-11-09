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
    if (list.length === 0) {
      setStep('create');
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const list = getWishlistCollections();
      setCollections(list);
      setNewCollectionName('');
      if (list.length === 0) {
        setStep('create');
      } else {
        setStep('select');
      }
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
    const snapshot = tourTitle
      ? {
          id: tourId,
          title: tourTitle,
          coverImage: tourCoverImage,
        }
      : undefined;
    addTourToCollection(collection.id, tourId, snapshot);
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

    const snapshot = tourTitle
      ? {
          id: tourId,
          title: tourTitle,
          coverImage: tourCoverImage,
        }
      : undefined;

    const newCol = createWishlistCollection(newCollectionName.trim(), tourId, snapshot);
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
        <div className="relative w-full max-w-[540px] overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 text-left shadow-2xl animate-fadeInScale">
          {/* STEP 1: SELECT COLLECTION (Ảnh 2: Grid 2 cột) */}
          {step === 'select' ? (
            <div>
              {/* Header with Centered Title & Close X */}
              <div className="relative flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="size-8" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 text-center">
                  Lưu vào danh sách yêu thích
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Đóng"
                  className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Collections Grid (Ảnh 2) */}
              <div className="my-5 max-h-[60vh] overflow-y-auto grid grid-cols-2 gap-4 pr-1">
                {collections.map((col) => {
                  const isTourSaved = col.tourIds.includes(tourId);
                  const previewImages = col.tourIds
                    .map((id) => col.tours?.[id]?.coverImage)
                    .filter(Boolean) as string[];
                  if (previewImages.length === 0 && isTourSaved && tourCoverImage) {
                    previewImages.push(tourCoverImage);
                  }

                  const firstCover = previewImages[0] || tourCoverImage;

                  return (
                    <div
                      key={col.id}
                      onClick={() => handleSelectCollection(col)}
                      className="group flex flex-col cursor-pointer select-none text-left"
                    >
                      <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 group-hover:border-slate-400 group-hover:shadow-sm transition-all">
                        {firstCover ? (
                          <img
                            src={firstCover}
                            alt={col.name}
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <CollageImageGrid
                            images={previewImages}
                            altTitle={col.name}
                            className="size-full !rounded-2xl sm:!rounded-3xl"
                          />
                        )}
                      </div>
                      <div className="pt-2">
                        <h4 className="font-semibold text-sm text-slate-900 truncate">
                          {col.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Đã lưu {col.tourIds.length} mục
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Button: Tạo danh sách mong muốn mới (Ảnh 2) */}
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep('create')}
                  className="w-full py-3.5 px-4 rounded-xl sm:rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-sm sm:text-base shadow-sm transition-colors cursor-pointer text-center"
                >
                  Tạo danh sách mong muốn mới
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: CREATE COLLECTION (Ảnh 3) */
            <form onSubmit={handleCreateCollection}>
              {/* Header with Back Arrow and Centered Title (Không có nút X theo Ảnh 3) */}
              <div className="relative flex items-center justify-between pb-3.5 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (collections.length > 0) {
                      setStep('select');
                    } else {
                      onClose();
                    }
                  }}
                  aria-label="Quay lại"
                  className="flex size-8 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 text-center flex-1">
                  Tạo Danh sách yêu thích
                </h3>
                <div className="size-8" />
              </div>

              <div className="my-6 text-left">
                <div className="relative rounded-2xl border border-slate-300 focus-within:border-slate-800 focus-within:ring-1 focus-within:ring-slate-800 px-4 py-3.5 transition-all">
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Tên"
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="mt-2 text-left text-xs text-slate-500 font-medium">
                  {newCollectionName.length}/50 ký tự
                </div>
              </div>

              {/* Actions (Ảnh 3) */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (collections.length > 0) {
                      setStep('select');
                    } else {
                      onClose();
                    }
                  }}
                  className="px-2 py-2 text-sm font-bold text-slate-900 hover:underline cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newCollectionName.trim()}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    newCollectionName.trim()
                      ? 'bg-neutral-900 text-white hover:bg-neutral-800 cursor-pointer shadow-sm'
                      : 'bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed'
                  }`}
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
