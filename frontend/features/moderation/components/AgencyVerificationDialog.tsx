'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Building2, Check, ExternalLink, FileText, Loader2, MessageSquareMore, ShieldCheck, X } from 'lucide-react';
import { Modal } from '@/components/ui';
import { AGENCY_STATUS_LABELS, REASON_MAX, validateReason } from '../labels';
import type { ModerationAgency } from '../types';
import { dateTime } from './ModerationUi';

/** Only web URLs are navigable; profile fields are supplied by applicants. */
export function agencyWebUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function AgencyStatusBadge({ agency }: { agency: ModerationAgency }) {
  const status = AGENCY_STATUS_LABELS[agency.agencyProfile?.verificationStatus ?? 'UNVERIFIED'];
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${status.className}`}>{status.label}</span>;
}

export function agencySubmittedAt(agency: ModerationAgency) {
  const profile = agency.agencyProfile;
  const date = new Date(profile?.submittedAt ?? agency.createdAt);
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian nộp';
  return `${dateTime.format(date)}${!profile?.submittedAt || profile.submissionDateEstimated ? ' (ước lượng)' : ''}`;
}

function Field({ label, children }: { label: string; children?: ReactNode }) {
  return <div className="min-w-0 space-y-1"><dt className="text-sm text-slate-500">{label}</dt><dd className="break-words text-base leading-6 text-slate-900">{children || <span className="text-slate-500">Chưa cung cấp</span>}</dd></div>;
}

interface Props {
  agency: ModerationAgency;
  isSubmitting: boolean;
  serverError: string | null;
  onClose: () => void;
  onDecide: (approve: boolean, note: string, requestInformation?: boolean) => Promise<void>;
}

/** Separate from the shared decision dialog so other moderation screens keep their layout. */
export function AgencyVerificationDialog({ agency, isSubmitting, serverError, onClose, onDecide }: Props) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const profile = agency.agencyProfile;
  const canDecide = profile?.verificationStatus === 'PENDING';
  const documentUrl = agencyWebUrl(profile?.businessLicenseUrl);
  const website = agencyWebUrl(profile?.website);
  const close = () => { if (!isSubmitting && !sending.current) onClose(); };
  const decide = async (approve: boolean, requestInformation = false) => {
    if (!canDecide || isSubmitting || sending.current) return;
    const validation = !approve ? validateReason(note) : null;
    setError(validation);
    if (validation) { noteRef.current?.focus(); return; }
    sending.current = true;
    try { await onDecide(approve, note.trim(), requestInformation); }
    finally { sending.current = false; }
  };
  const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <Modal open onClose={close} closeOnBackdrop={!isSubmitting} title="Hồ sơ agency" className="max-w-5xl" contentClassName="!p-0"
      footer={<div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" disabled={isSubmitting} onClick={close} className={`${buttonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-100 sm:mr-auto`}>{canDecide ? 'Hủy' : 'Đóng'}</button>
        {canDecide && <>
          <button type="button" disabled={isSubmitting} onClick={() => void decide(false)} className={`${buttonClass} border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}><X className="size-4" aria-hidden="true" />Từ chối</button>
          <button type="button" disabled={isSubmitting} onClick={() => void decide(false, true)} className={`${buttonClass} border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100`}><MessageSquareMore className="size-4" aria-hidden="true" />Yêu cầu bổ sung</button>
          <button type="button" disabled={isSubmitting} onClick={() => void decide(true)} className={`${buttonClass} border-brand-teal bg-brand-teal text-white hover:bg-teal-800`}>{isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}{isSubmitting ? 'Đang xử lý...' : 'Xác minh'}</button>
        </>}
      </div>}>
      <div className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-teal-100/70 text-teal-800"><Building2 className="size-7" aria-hidden="true" /></span>
            <div className="min-w-0"><h3 className="break-words text-2xl font-bold tracking-tight text-slate-900">{profile?.companyName || agency.fullName}</h3><p className="mt-2 text-sm text-slate-600">Nộp hồ sơ · {agencySubmittedAt(agency)}</p></div>
          </div>
          <AgencyStatusBadge agency={agency} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8 p-5 sm:p-8">
          <section aria-labelledby="agency-business-title">
            <h4 id="agency-business-title" className="mb-4 text-lg font-semibold text-slate-900">Thông tin doanh nghiệp</h4>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Tên doanh nghiệp">{profile?.companyName}</Field>
              <Field label="Website">{website ? <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-800 underline underline-offset-4">{profile?.website}<ExternalLink className="size-3 shrink-0" aria-hidden="true" /></a> : profile?.website}</Field>
              <div className="sm:col-span-2"><Field label="Địa chỉ">{profile?.address}</Field></div>
              <div className="sm:col-span-2"><Field label="Giới thiệu">{profile?.description && <span className="whitespace-pre-wrap">{profile.description}</span>}</Field></div>
            </dl>
          </section>
          <section aria-labelledby="agency-contact-title" className="border-t border-slate-200 pt-6">
            <h4 id="agency-contact-title" className="mb-4 text-lg font-semibold text-slate-900">Người đại diện</h4>
            <dl className="grid gap-5 sm:grid-cols-2"><Field label="Họ và tên">{agency.fullName}</Field><Field label="Điện thoại">{agency.phone}</Field><div className="sm:col-span-2"><Field label="Email">{agency.email}</Field></div></dl>
          </section>
          {profile?.verificationNote && <section className="border-t border-slate-200 pt-6"><h4 className="mb-3 text-lg font-semibold text-slate-900">Ghi chú gần nhất</h4><p className="whitespace-pre-wrap break-words text-base leading-7 text-slate-700">{profile.verificationNote}</p></section>}
        </div>

        <aside aria-label="Thông tin pháp lý" className="min-w-0 border-t border-slate-200 bg-slate-50/60 p-5 sm:p-8 lg:border-l lg:border-t-0">
          <h4 className="mb-5 flex items-center gap-2 text-lg font-semibold text-slate-900"><ShieldCheck className="size-5 text-teal-800" aria-hidden="true" />Hồ sơ pháp lý</h4>
          <dl className="space-y-5"><Field label="Số giấy phép">{profile?.licenseNumber}</Field><Field label="Mã số thuế">{profile?.taxId}</Field></dl>
          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="mb-3 text-sm text-slate-500">Giấy phép kinh doanh</p>
            {documentUrl ? <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-brand-teal"><FileText className="size-5 shrink-0" aria-hidden="true" /><span className="flex-1">Mở tài liệu đính kèm</span><ExternalLink className="size-4 shrink-0" aria-hidden="true" /></a> : <p className="text-base text-slate-600">{profile?.businessLicenseUrl ? 'Liên kết tài liệu không hợp lệ.' : 'Chưa có tài liệu đính kèm.'}</p>}
          </div>
        </aside>
      </div>

      {(canDecide || serverError) && <div className="space-y-3 border-t border-slate-200 p-5 sm:px-8 sm:py-6">
        {serverError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-800">{serverError}</p>}
        {canDecide && <>
          <label htmlFor="agency-verification-note" className="block text-base font-semibold text-slate-900">Ghi chú xử lý</label>
          <textarea ref={noteRef} id="agency-verification-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={REASON_MAX} disabled={isSubmitting} aria-invalid={!!error} aria-describedby={error ? 'agency-note-help agency-note-error' : 'agency-note-help'} className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 caret-brand-teal focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20" />
          <div className="flex items-start justify-between gap-4 text-sm text-slate-500"><p id="agency-note-help">Bắt buộc khi yêu cầu bổ sung hoặc từ chối.</p><span className="shrink-0 tabular-nums">{note.length}/{REASON_MAX}</span></div>
          {error && <p id="agency-note-error" role="alert" className="text-sm font-medium text-rose-700">{error}</p>}
        </>}
      </div>}
    </Modal>
  );
}
