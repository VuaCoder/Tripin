'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui';
import { REASON_MAX, validateReason } from '../labels';

export interface DecisionAction {
  key: string;
  label: string;
  tone: 'positive' | 'negative';
  /** Reject / suspend need a reason; the backend rejects an empty one. */
  requiresReason: boolean;
  /** Backend maximum for this action's reason when it differs from the shared 1000 (e.g. a resolution note). */
  maxReason?: number;
  onConfirm: (reason: string) => void;
}

interface DecisionDialogProps {
  open: boolean;
  title: string;
  reasonLabel: string;
  /** Facts about the item being decided. */
  children: ReactNode;
  /** Empty when the item can no longer be decided (or the moderator lacks the permission). */
  actions: DecisionAction[];
  isSubmitting: boolean;
  /** Message returned by the backend for the last attempt; keeps the dialog open. */
  serverError?: string | null;
  onClose: () => void;
}

const TONE = {
  positive: {
    icon: 'check_circle',
    className:
      'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-600/40 focus-visible:ring-emerald-500',
  },
  negative: {
    icon: 'block',
    className:
      'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-red-600/25 hover:from-rose-600 hover:to-red-700 hover:shadow-red-600/40 focus-visible:ring-red-500',
  },
} as const;

/** Lift on hover, press on click, and a spinner while the backend is working. */
const ACTION_CLASS =
  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0';
const CLOSE_CLASS =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 active:translate-y-0 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';

/** Shared "decide with an optional/required reason" dialog for tour validation, suspension, agency verification, disputes and reviews. */
export function DecisionDialog({ open, title, reasonLabel, children, actions, isSubmitting, serverError, onClose }: DecisionDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const run = (action: DecisionAction) => {
    if (action.requiresReason) {
      const found = validateReason(reason, action.maxReason);
      setError(found);
      if (found) return;
    } else {
      setError(null);
    }
    action.onConfirm(reason.trim());
  };

  // The textarea accepts whatever the most permissive action of this dialog allows.
  const reasonMax = actions.reduce((max, action) => Math.max(max, action.maxReason ?? REASON_MAX), REASON_MAX);

  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop={!isSubmitting} title={title} className="max-h-[90vh] max-w-xl overflow-y-auto">
      <div className="space-y-3 text-sm">
        {serverError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {serverError}
          </div>
        )}
        {children}
      </div>

      {actions.length > 0 ? (
        <div className="mt-4 space-y-2">
          <label htmlFor="moderation-reason" className="block text-sm font-semibold text-slate-700">
            {reasonLabel}
          </label>
          <textarea
            id="moderation-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={reasonMax}
            disabled={isSubmitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'moderation-reason-error' : undefined}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-purple-400 focus:outline-none"
          />
          {error && (
            <p id="moderation-reason-error" role="alert" className="text-xs font-semibold text-red-600">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={isSubmitting} className={CLOSE_CLASS}>
              Đóng
            </button>
            {actions.map((a) => (
              <button key={a.key} type="button" disabled={isSubmitting} onClick={() => run(a)} className={`${ACTION_CLASS} ${TONE[a.tone].className}`}>
                {isSubmitting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    {TONE[a.tone].icon}
                  </span>
                )}
                {isSubmitting ? 'Đang xử lý...' : a.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className={CLOSE_CLASS}>
            Đóng
          </button>
        </div>
      )}
    </Modal>
  );
}
