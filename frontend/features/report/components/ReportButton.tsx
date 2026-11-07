'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flag, CheckCircle2 } from 'lucide-react';
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
  iconOnly?: boolean;
}

/**
 * "Send report" entry point. Hidden for anyone without `report:create` (the backend re-checks it), and the
 * success badge only appears after the backend has confirmed — `unwrap()` throws on any error.
 */
export function ReportButton({
  targetType,
  targetId,
  targetLabel,
  className,
  iconOnly = false,
}: ReportButtonProps) {
  const allowed = useAppSelector(selectUser)?.permissions.includes('report:create') ?? false;
  const [createReport, { isLoading }] = useCreateReportMutation();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [reportCode, setReportCode] = useState<string | null>(null);

  if (!allowed) return null;

  const submit = async (input: CreateReportInput) => {
    setServerError(null);
    try {
      const created = await createReport(input).unwrap();
      setReportCode(created.code ?? null);
      setSent(true);
      setOpen(false);
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      setServerError((code && REPORT_ERROR_MESSAGES[code]) || getApiErrorMessage(err, 'Không thể gửi báo cáo lúc này. Vui lòng thử lại.'));
    }
  };

  return (
    <div className={className}>
      {sent ? (
        <Link
          href="/settings/reports"
          role="status"
          aria-label={reportCode ? `Đã gửi báo cáo · Mã tra cứu ${reportCode}` : 'Đã gửi báo cáo'}
          title={reportCode ? `Đã gửi báo cáo · Mã tra cứu ${reportCode}` : 'Đã gửi báo cáo'}
          className={
            iconOnly
              ? 'inline-flex size-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 transition hover:bg-emerald-100 shadow-2xs'
              : 'inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 shadow-2xs'
          }
        >
          <CheckCircle2 className={`${iconOnly ? 'size-5' : 'size-4'} text-emerald-600 shrink-0`} />
          {!iconOnly && <span>{reportCode ? `Đã gửi báo cáo · Mã tra cứu ${reportCode}` : 'Đã gửi báo cáo'}</span>}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => {
            setServerError(null);
            setSent(false);
            setOpen(true);
          }}
          aria-label="Báo cáo"
          title="Báo cáo"
          className={
            iconOnly
              ? 'inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer shadow-2xs active:scale-95'
              : 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer'
          }
        >
          <Flag className={`${iconOnly ? 'size-5' : 'size-4'} text-slate-500 shrink-0`} />
          {!iconOnly && <span>Báo cáo</span>}
        </button>
      )}

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
