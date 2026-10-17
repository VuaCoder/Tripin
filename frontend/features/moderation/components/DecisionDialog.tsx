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
  positive: 'bg-emerald-600 text-white hover:bg-emerald-700',
  negative: 'bg-red-600 text-white hover:bg-red-700',
} as const;

/** Shared "decide with an optional/required reason" dialog for tour validation, suspension and agency verification. */
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
      const found = validateReason(reason);
      setError(found);
      if (found) return;
    } else {
      setError(null);
    }
    action.onConfirm(reason.trim());
  };

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
            maxLength={REASON_MAX + 200}
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
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Đóng
            </button>
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={isSubmitting}
                onClick={() => run(a)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${TONE[a.tone]}`}
              >
                {isSubmitting ? 'Đang xử lý...' : a.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Đóng
          </button>
        </div>
      )}
    </Modal>
  );
}
