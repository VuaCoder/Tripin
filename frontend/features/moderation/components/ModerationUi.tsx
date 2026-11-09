'use client';

import { useContext, useEffect, useRef } from 'react';
import { ReactReduxContext } from 'react-redux';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import { pushNotification } from '@/features/agency/notifications';
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
  const reduxContext = useContext(ReactReduxContext);
  const dispatch = reduxContext?.store?.dispatch;
  const lastPushed = useRef<string | null>(null);

  // When an update happens, push it to the notification center so bell badge increments
  useEffect(() => {
    if (feedback && feedback.type === 'success' && feedback.message !== lastPushed.current) {
      lastPushed.current = feedback.message;
      if (dispatch) {
        try {
          pushNotification(dispatch, {
            title: 'Cập nhật kiểm duyệt',
            body: feedback.message,
          });
        } catch {
          // ignore in tests without active store
        }
      }
    }
  }, [feedback, dispatch]);

  // Ant Design style auto-dismiss after 4.5 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [feedback, onClose]);

  if (!feedback) return null;

  const isSuccess = feedback.type === 'success';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      className="fixed top-6 right-6 z-[100] flex w-96 max-w-[calc(100vw-32px)] items-start gap-3.5 rounded-2xl border border-slate-100 bg-white p-4 text-slate-800 shadow-[0_6px_16px_0_rgba(0,0,0,0.08),0_3px_6px_-4px_rgba(0,0,0,0.12),0_9px_28px_8px_rgba(0,0,0,0.05)] transition-all animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      {/* Ant Design Style Status Icon */}
      {isSuccess ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mt-0.5">
          <CheckCircle2 className="size-5 text-emerald-500" />
        </span>
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 mt-0.5">
          <AlertCircle className="size-5 text-rose-500" />
        </span>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <h4 className="text-sm font-bold text-slate-900 leading-tight">
          {isSuccess ? 'Thành công' : 'Thông báo lỗi'}
        </h4>
        <p className="mt-1 text-xs text-slate-600 leading-relaxed font-medium">
          {feedback.message}
        </p>
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng thông báo"
        className="flex size-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer -mr-1 -mt-1"
      >
        <X className="size-4" />
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
