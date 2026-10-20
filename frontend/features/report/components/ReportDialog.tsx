'use client';

import { useEffect, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { REPORT_CATEGORY_LABELS, REPORT_TARGET_LABELS, validateReportDescription } from '../labels';
import { REPORT_DESCRIPTION_MAX, type CreateReportInput, type ReportCategory, type ReportTarget } from '../types';

interface ReportDialogProps {
  open: boolean;
  targetType: ReportTarget;
  targetId: string;
  /** Human label of the reported thing, when the caller knows it (e.g. the tour title). */
  targetLabel?: string;
  /** Wording overrides: an agency "phản ánh" a review rather than "báo cáo" a tour. */
  title?: string;
  hint?: string;
  isSubmitting: boolean;
  /** Message returned by the backend for the last attempt; keeps the dialog open. */
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (input: CreateReportInput) => void;
}

const CATEGORIES = Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[];
const DEFAULT_HINT =
  'Báo cáo của bạn được gửi tới kiểm duyệt viên. Đối tác liên quan có thể phản hồi một lần trước khi có quyết định cuối cùng.';

/** The "Send report" form: category + description. Every rule the backend enforces is mirrored here. */
export function ReportDialog({
  open,
  targetType,
  targetId,
  targetLabel,
  title = 'Gửi báo cáo',
  hint = DEFAULT_HINT,
  isSubmitting,
  serverError,
  onClose,
  onSubmit,
}: ReportDialogProps) {
  const [category, setCategory] = useState<ReportCategory>('SERVICE_QUALITY');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory('SERVICE_QUALITY');
    setDescription('');
    setError(null);
  }, [open, targetId]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateReportDescription(description);
    setError(found);
    if (found) return;
    onSubmit({ targetType, targetId, category, description: description.trim() });
  };

  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop={!isSubmitting} title={title} className="max-h-[90vh] max-w-xl overflow-y-auto">
      <form onSubmit={handleSubmit} noValidate className="space-y-3 text-sm">
        {serverError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {serverError}
          </div>
        )}

        <p className="rounded-xl bg-slate-50 p-3 text-slate-700">
          <span className="font-semibold">{REPORT_TARGET_LABELS[targetType]}:</span> {targetLabel ?? targetId}
        </p>

        <label htmlFor="report-category" className="block text-sm font-semibold text-slate-700">
          Loại vấn đề
        </label>
        <select
          id="report-category"
          value={category}
          disabled={isSubmitting}
          onChange={(e) => setCategory(e.target.value as ReportCategory)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-50"
        >
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {REPORT_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>

        <label htmlFor="report-description" className="block text-sm font-semibold text-slate-700">
          Mô tả chi tiết
        </label>
        <textarea
          id="report-description"
          rows={5}
          maxLength={REPORT_DESCRIPTION_MAX}
          value={description}
          disabled={isSubmitting}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'report-description-error' : undefined}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-50"
        />
        {error && (
          <p id="report-description-error" role="alert" className="text-xs font-semibold text-red-600">
            {error}
          </p>
        )}
        <p className="text-xs text-slate-500">{hint}</p>

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </Button>
          <Button type="submit" loading={isSubmitting} loadingLabel="Đang gửi...">
            Gửi báo cáo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
