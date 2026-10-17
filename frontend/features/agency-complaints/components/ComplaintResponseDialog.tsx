'use client';

import { useEffect, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { CATEGORY_LABELS, RESPONSE_MAX, STATUS_LABELS, validateResponseText } from '../labels';
import type { Complaint } from '../types';

interface ComplaintResponseDialogProps {
  open: boolean;
  complaint: Complaint | null;
  isSubmitting: boolean;
  /** Message returned by the backend for the last submit; keeps the dialog open. */
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** Details of a complaint plus the one-time agency response (only while it is still OPEN). */
export function ComplaintResponseDialog({ open, complaint, isSubmitting, serverError, onClose, onSubmit }: ComplaintResponseDialogProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
    }
  }, [open, complaint?.id]);

  if (!complaint) return null;
  const status = STATUS_LABELS[complaint.status];
  const canRespond = complaint.status === 'OPEN';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateResponseText(text);
    setError(found);
    if (found) return;
    onSubmit(text.trim());
  };

  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop={!isSubmitting} title="Chi tiết khiếu nại" className="max-h-[90vh] max-w-xl overflow-y-auto">
      <div className="space-y-3 text-sm">
        {serverError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {serverError}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
          <span className="text-slate-600">{CATEGORY_LABELS[complaint.category]}</span>
        </div>
        <p className="text-xs text-slate-500">
          Từ {complaint.reporterName} · {dateTime.format(new Date(complaint.createdAt))}
        </p>
        <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-800">{complaint.description}</p>

        {complaint.agencyResponse && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-bold text-blue-800">Phản hồi của bạn · {dateTime.format(new Date(complaint.agencyResponse.respondedAt))}</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{complaint.agencyResponse.text}</p>
          </div>
        )}

        {complaint.resolution && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-bold text-emerald-800">Quyết định của kiểm duyệt viên · {dateTime.format(new Date(complaint.resolution.resolvedAt))}</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{complaint.resolution.note}</p>
          </div>
        )}
      </div>

      {canRespond ? (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-2">
          <label htmlFor="complaint-response" className="block text-sm font-semibold text-slate-700">
            Phản hồi của đại lý (chỉ gửi được một lần)
          </label>
          <textarea
            id="complaint-response"
            rows={4}
            maxLength={RESPONSE_MAX}
            value={text}
            disabled={isSubmitting}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-50"
          />
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Đóng
            </Button>
            <Button type="submit" loading={isSubmitting} loadingLabel="Đang gửi...">
              Gửi phản hồi
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Đóng
          </Button>
        </div>
      )}
    </Modal>
  );
}
