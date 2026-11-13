'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  cancelText?: string;
  confirmText?: string;
  /**
   * Action button variant:
   * - 'danger' (default): Red button (bg-rose-600 hover:bg-rose-700 text-white) for delete / destructive actions
   * - 'primary': Brand teal button (bg-teal-700 hover:bg-teal-800 text-white)
   * - 'neutral': Dark button (bg-slate-900 hover:bg-slate-800 text-white)
   */
  variant?: 'danger' | 'primary' | 'neutral';
  isLoading?: boolean;
  confirmDisabled?: boolean;
  maxWidthClass?: string;
  closeOnBackdrop?: boolean;
}

/**
 * Standard confirmation popup modal across the platform.
 * Follows the modern rounded card layout with top-right close button,
 * left-aligned title & description, divider, and left 'Hủy' / right red 'Xóa' actions.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  cancelText = 'Hủy',
  confirmText = 'Xác nhận',
  variant = 'danger',
  isLoading = false,
  confirmDisabled = false,
  maxWidthClass = 'max-w-md',
  closeOnBackdrop = true,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen || !mounted) return null;

  const handleConfirm = async () => {
    if (isLoading || confirmDisabled) return;
    await onConfirm();
  };

  const getVariantButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm shadow-rose-600/20';
      case 'primary':
        return 'bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white shadow-sm shadow-teal-700/20';
      case 'neutral':
        return 'bg-slate-900 hover:bg-slate-800 active:bg-black text-white shadow-sm';
      default:
        return 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm shadow-rose-600/20';
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[9999] overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-fadeIn"
        onClick={() => {
          if (closeOnBackdrop && !isLoading) onClose();
        }}
        aria-hidden="true"
      />

      {/* Centering wrapper */}
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        {/* Modal Card */}
        <div
          className={`relative w-full ${maxWidthClass} overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 sm:p-7 text-left shadow-2xl animate-fadeInScale`}
        >
          {/* Top-Right Close X Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Đóng"
            className="absolute top-5 right-5 flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Title */}
          <h3
            id="confirm-dialog-title"
            className="text-lg sm:text-xl font-bold text-slate-900 pr-8 tracking-tight"
          >
            {title}
          </h3>

          {/* Description */}
          {description && (
            <div className="mt-3 text-sm text-slate-600 leading-relaxed font-normal">
              {description}
            </div>
          )}

          {/* Optional custom children */}
          {children && <div className="mt-4">{children}</div>}

          {/* Actions Footer */}
          <div className="mt-7 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading || confirmDisabled}
              className={`px-7 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50 ${getVariantButtonClass()}`}
            >
              {isLoading ? (
                <>
                  <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ConfirmDialog;

