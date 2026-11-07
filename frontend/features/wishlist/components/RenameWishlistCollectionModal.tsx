'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface RenameWishlistCollectionModalProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onSave: (newName: string) => void;
}

/**
 * Modal to rename a wishlist collection matching Image 3 design:
 * - Back arrow on left, centered title "Đổi tên Danh sách yêu thích"
 * - Rounded input container with label "Tên" & clear "x" button
 * - Character count "X/50 ký tự"
 * - Horizontal separator line
 * - "Hủy" button on left, "Lưu" button on right (disabled/gray if empty or unchanged)
 */
export function RenameWishlistCollectionModal({
  isOpen,
  currentName,
  onClose,
  onSave,
}: RenameWishlistCollectionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
    }
  }, [isOpen, currentName]);

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

  const isChanged = name.trim().length > 0 && name.trim() !== currentName;
  const isValid = name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !isChanged) return;
    onSave(name.trim());
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-collection-title"
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
        <div className="relative w-full max-w-[500px] overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 text-left shadow-2xl animate-fadeInScale">
          <form onSubmit={handleSubmit}>
            {/* Header with Back Arrow and Centered Title (Ảnh 3) */}
            <div className="relative flex items-center justify-between pb-3.5 border-b border-slate-100">
              <button
                type="button"
                onClick={onClose}
                aria-label="Quay lại"
                className="flex size-8 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">arrow_back</span>
              </button>
              <h3
                id="rename-collection-title"
                className="text-base sm:text-lg font-bold text-slate-900 text-center flex-1"
              >
                Đổi tên Danh sách yêu thích
              </h3>
              <div className="size-8" />
            </div>

            {/* Input field box with clear button (Ảnh 3) */}
            <div className="my-6 text-left">
              <div className="relative rounded-2xl border border-slate-300 focus-within:border-slate-800 focus-within:ring-1 focus-within:ring-slate-800 px-4 py-3 transition-all flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] font-medium text-slate-500">
                    Tên
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tên danh sách"
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none pt-0.5"
                    autoFocus
                  />
                </div>

                {name.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setName('')}
                    aria-label="Xóa nội dung"
                    className="shrink-0 flex size-6 items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                  </button>
                )}
              </div>

              {/* Character counter */}
              <div className="mt-2 text-left text-xs text-slate-500 font-medium">
                {name.length}/50 ký tự
              </div>
            </div>

            {/* Actions: Hủy & Lưu (Ảnh 3) */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-2 py-2 text-sm font-bold text-slate-900 hover:underline cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!isValid || !isChanged}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isValid && isChanged
                    ? 'bg-neutral-900 text-white hover:bg-neutral-800 cursor-pointer shadow-sm'
                    : 'bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed'
                }`}
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

