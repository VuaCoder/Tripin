'use client';

import { useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import { useCreateReportMutation } from '../api/reportApi';
import { REPORT_ERROR_MESSAGES } from '../labels';
import type { CreateReportInput, ReportTarget } from '../types';
import { ReportDialog } from './ReportDialog';

interface ReportButtonProps {
  targetType: ReportTarget;
  targetId: string;
  targetLabel?: string;
  className?: string;
}

/**
 * "Send report" entry point. Hidden for anyone without `report:create` (the backend re-checks it), and the
 * success banner only appears after the backend has confirmed — `unwrap()` throws on any error.
 */
export function ReportButton({ targetType, targetId, targetLabel, className }: ReportButtonProps) {
  const allowed = useAppSelector(selectUser)?.permissions.includes('report:create') ?? false;
  const [createReport, { isLoading }] = useCreateReportMutation();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!allowed) return null;

  const submit = async (input: CreateReportInput) => {
    setServerError(null);
    try {
      await createReport(input).unwrap();
      setSent(true);
      setOpen(false);
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      setServerError((code && REPORT_ERROR_MESSAGES[code]) || getApiErrorMessage(err, 'Không thể gửi báo cáo lúc này. Vui lòng thử lại.'));
    }
  };

  return (
    <div className={className}>
      {sent && (
        <p role="status" className="mb-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
          Đã gửi báo cáo. Bạn có thể theo dõi tiến trình trong mục “Báo cáo của tôi”.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setServerError(null);
          setSent(false);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">flag</span>
        Báo cáo
      </button>

      <ReportDialog
        open={open}
        targetType={targetType}
        targetId={targetId}
        targetLabel={targetLabel}
        isSubmitting={isLoading}
        serverError={serverError}
        onClose={() => setOpen(false)}
        onSubmit={(input) => void submit(input)}
      />
    </div>
  );
}
