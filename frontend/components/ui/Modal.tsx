'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  closeOnBackdrop?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  contentClassName,
  closeOnBackdrop = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock background scrolling so page behind does not shift or scroll
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;
  // SSR guard: wait for client mount before rendering portal, but allow synchronous in unit tests
  if (!mounted && typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    return null;
  }
  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  const hasCustomMaxWidth = className && /\bmax-w-/.test(className);

  // Strip accidental overflow or outer padding classes from className
  // so the outer modal container remains strictly overflow-hidden with pristine rounded corners.
  const cleanSectionClass = className
    ? className
        .replace(/\boverflow-y-auto\b/g, '')
        .replace(/\boverflow-auto\b/g, '')
        .replace(/\bmax-h-\[[^\]]+\]/g, '')
        .replace(/\bmax-h-\S+/g, '')
        .replace(/\b(p|px|py|pt|pb|pl|pr)-\d+\b/g, '')
        .replace(/\bsm:(p|px|py|pt|pb|pl|pr)-\d+\b/g, '')
        .replace(/\blg:(p|px|py|pt|pb|pl|pr)-\d+\b/g, '')
        .trim()
    : '';

  const modalElement = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-slate-900/10 p-4 sm:p-6 overflow-y-auto transition-opacity"
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-modal-title"
        className={cn(
          'relative flex flex-col w-full my-auto rounded-2xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden transition-all max-h-[min(90vh,calc(100vh-2.5rem))]',
          !hasCustomMaxWidth && 'max-w-lg',
          cleanSectionClass
        )}
      >
        {/* Pinned Header: Title & Close Button */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <h2 id="shared-modal-title" className="text-lg font-bold text-slate-900 truncate pr-2">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal shrink-0"
            aria-label="Đóng hộp thoại"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Content Body with Custom Sleek Scrollbar */}
        <div className={cn('flex-1 overflow-y-auto ant-scrollbar p-5 sm:p-6', contentClassName)}>
          {children}
        </div>

        {/* Optional Pinned Footer */}
        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:px-6">
            {footer}
          </div>
        )}
      </section>
    </div>
  );

  return createPortal(modalElement, document.body);
}
