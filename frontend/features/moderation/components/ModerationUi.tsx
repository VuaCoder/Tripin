'use client';

import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import { MODERATION_ERROR_MESSAGES } from '../labels';

/** True when the logged-in user holds `permission` (the backend re-checks it on every request). */
export function useModerationPermission(permission: string): boolean {
  return useAppSelector(selectUser)?.permissions.includes(permission) ?? false;
}

export function ModerationDenied() {
  return (
    <p role="alert" className="mx-auto max-w-5xl p-6 text-slate-700">
      Bạn không có quyền truy cập chức năng này.
    </p>
  );
}

export type Feedback = { message: string; type: 'success' | 'error' };

export function FeedbackBanner({ feedback, onClose }: { feedback: Feedback | null; onClose: () => void }) {
  if (!feedback) return null;
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-semibold ${
        feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
      }`}
      role={feedback.type === 'error' ? 'alert' : 'status'}
    >
      <span>{feedback.message}</span>
      <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="text-slate-400 hover:text-slate-600">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
      </button>
    </div>
  );
}

/** Backend message for a failed moderation call: mapped by error code first, then the server's own text. */
export function moderationErrorMessage(err: unknown, fallback: string): string {
  const code = getApiErrorCode(err);
  return (code && MODERATION_ERROR_MESSAGES[code]) || getApiErrorMessage(err, fallback);
}

export const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
export const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
