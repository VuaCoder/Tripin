'use client';

import { useEffect } from 'react';

interface PremiumComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PremiumComingSoonModal({ isOpen, onClose }: PremiumComingSoonModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/40 bg-white p-6 sm:p-8 text-center shadow-2xl shadow-amber-500/10 animate-fadeInScale">
        {/* Ambient gold glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-48 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-48 rounded-full bg-yellow-400/20 blur-3xl" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Icon */}
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 via-yellow-400/30 to-amber-500/20 text-amber-600 shadow-inner ring-1 ring-amber-400/40">
          <span
            className="material-symbols-outlined text-[36px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            workspace_premium
          </span>
        </div>

        {/* Badge */}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
          TRIPRI PREMIUM
        </div>

        {/* Title */}
        <h3 id="premium-modal-title" className="mt-3 text-xl font-extrabold text-slate-900 sm:text-2xl">
          Tính năng đang được phát triển
        </h3>

        {/* Body */}
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Tính năng <strong>Tripri Premium</strong> đang được đội ngũ hoàn thiện và sẽ sớm ra mắt với vô vàn đặc quyền ưu đãi dành cho bạn. Xin vui lòng chờ đợi thêm nhé!
        </p>

        {/* Action Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="btn-premium-gold w-full rounded-2xl py-3 text-sm font-bold shadow-md transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="premium-shine-rtl" aria-hidden="true" />
            <span className="relative z-10 text-amber-950 font-extrabold">Đã hiểu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
