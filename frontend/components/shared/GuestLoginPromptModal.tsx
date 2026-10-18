'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

export interface GuestLoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectUrl?: string;
  tourTitle?: string;
}

export function GuestLoginPromptModal({
  isOpen,
  onClose,
  redirectUrl,
}: GuestLoginPromptModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tripri:navigation-end'));
    }
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

  const loginHref = redirectUrl
    ? `/login?next=${encodeURIComponent(redirectUrl)}`
    : '/login';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-prompt-title"
      className="fixed inset-0 z-[100] overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centering wrapper */}
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
        {/* Modal Card */}
        <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-2xl animate-fadeInScale">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Brand Icon */}
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-teal-50 text-primary-container ring-1 ring-teal-200/60 shadow-inner">
          <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
            lock_open
          </span>
        </div>

        {/* Title */}
        <h3 id="login-prompt-title" className="mt-4 text-xl font-extrabold text-slate-900 sm:text-2xl">
          Yêu cầu đăng nhập
        </h3>

        {/* Description */}
        <p className="mt-2 text-sm leading-relaxed text-slate-600 font-medium">
          OOPS! Bạn cần đăng nhập để thao tác.
        </p>

        {/* Action Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(loginHref);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container py-3 text-sm font-bold text-white shadow-md shadow-primary-container/20 transition hover:bg-primary active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>Đăng nhập ngay</span>
          </button>
        </div>
      </div>
    </div>
  </div>,
  document.body
  );
}
