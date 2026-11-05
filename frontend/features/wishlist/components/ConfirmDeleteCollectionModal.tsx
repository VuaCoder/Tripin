'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmDeleteCollectionModalProps {
  isOpen: boolean;
  collectionName: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before deleting a wishlist collection/folder.
 * Matches Image 4 design with theme teal "Xóa" button.
 */
export function ConfirmDeleteCollectionModal({
  isOpen,
  collectionName,
  onClose,
  onConfirm,
}: ConfirmDeleteCollectionModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-collection-title"
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
        <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 text-left shadow-2xl animate-fadeInScale">
          {/* Top-Right Close X Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute top-5 right-5 flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          {/* Title */}
          <h3
            id="confirm-delete-collection-title"
            className="text-lg sm:text-xl font-bold text-slate-900 pr-8"
          >
            Xóa Danh sách yêu thích này?
          </h3>

          {/* Subtitle */}
          <p className="mt-2 text-sm text-slate-500">
            Danh sách &quot;{collectionName}&quot; sẽ bị xóa vĩnh viễn.
          </p>

          {/* Actions */}
          <div className="mt-7 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-7 py-2.5 rounded-2xl text-sm font-bold bg-[#087e8b] hover:bg-[#00636e] text-white shadow-sm transition-colors"
            >
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

