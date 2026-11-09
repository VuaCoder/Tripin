'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Compass, Flag, ShieldAlert, Star, X } from 'lucide-react';
import { useReportedReviewsQuery, useTriageReviewMutation, type ReportedReview } from '../api/reviewTriageApi';
import { useModerationPermission, ModerationDenied, moderationErrorMessage } from './ModerationUi';
import { PERMISSION } from '../labels';

export function ReviewModerationQueue({ hideTitle }: { hideTitle?: boolean } = {}) {
  const allowed = useModerationPermission(PERMISSION.reviewModerate);
  const canResolve = useModerationPermission(PERMISSION.disputeResolve);
  const [page, setPage] = useState(1);
  const query = useReportedReviewsQuery(page, { skip: !allowed || !canResolve });
  const [decide, mutation] = useTriageReviewMutation();
  const [selected, setSelected] = useState<ReportedReview>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!allowed || !canResolve) return <ModerationDenied />;

  async function act(keep: boolean) {
    if (!selected || mutation.isLoading) return;
    if (reason.trim().length < 3) {
      setError('Nhập lý do xử lý từ 3 ký tự.');
      return;
    }
    try {
      await decide({
        id: selected.id,
        contentVersion: selected.contentVersion,
        reportIds: selected.reports.map((report) => report.id),
        keep,
        reason: reason.trim(),
      }).unwrap();
      setSelected(undefined);
      setReason('');
      setError('');
      void query.refetch();
    } catch (err) {
      setError(moderationErrorMessage(err, 'Nội dung hoặc báo cáo đã thay đổi. Tải lại trước khi quyết định.'));
    }
  }

  return (
    <section className="space-y-6">
      {!hideTitle && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Đánh giá bị báo cáo
          </h1>
        </div>
      )}

      {query.isLoading && (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400 font-medium">
          Đang tải hàng đợi báo cáo...
        </div>
      )}

      {query.isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          <p className="font-semibold text-sm">Không thể tải hàng đợi báo cáo.</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-3 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition"
          >
            Thử lại
          </button>
        </div>
      )}

      {query.data?.items.length === 0 && (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-2xs">
          <div className="mx-auto size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <CheckCircle2 className="size-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Không có báo cáo cần xử lý.</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Hiện tại các đánh giá trên hệ thống đều tuân thủ chính sách cộng đồng và không có báo cáo vi phạm tồn đọng.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {query.data?.items.map((review) => (
          <article
            key={review.id}
            className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2">
                <Compass className="size-4 text-brand-teal shrink-0" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">{review.tourTitle}</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200/60">
                  <Star className="size-3.5 fill-amber-400 text-amber-500" />
                  <span>{review.rating}/5</span>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200/60">
                  <Flag className="size-3.5 text-rose-600" />
                  <span>{review.reportCount} báo cáo</span>
                </div>
              </div>
            </div>

            <div className="mt-3.5">
              <p className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed rounded-2xl bg-slate-50/70 p-4 border border-slate-100">
                &ldquo;{review.comment}&rdquo;
              </p>
            </div>

            {/* Review Photos if any */}
            {review.images && review.images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {review.images.map((img, idx) => (
                  <a
                    key={`${img}-${idx}`}
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    className="block size-16 sm:size-20 overflow-hidden rounded-xl border border-slate-200/90 bg-slate-100 shadow-2xs hover:scale-105 transition"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Ảnh review ${idx + 1}`} className="size-full object-cover" />
                  </a>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelected(review);
                  setReason('');
                  setError('');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-2 text-xs font-bold text-teal-900 shadow-2xs transition hover:bg-teal-100 hover:border-teal-300 cursor-pointer"
              >
                <span>Xem báo cáo và xử lý</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Decision Dialog Modal */}
      {selected && (
        <div
          role="dialog"
          aria-label="Xử lý review bị báo cáo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="size-5 text-rose-600" />
                <span>Xử lý đánh giá bị báo cáo</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelected(undefined)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Nội dung đánh giá</span>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">&ldquo;{selected.comment}&rdquo;</p>
              {selected.images && selected.images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-slate-200/60">
                  {selected.images.map((img, idx) => (
                    <a
                      key={`${img}-${idx}`}
                      href={img}
                      target="_blank"
                      rel="noreferrer"
                      className="block size-16 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs hover:scale-105 transition"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Ảnh review ${idx + 1}`} className="size-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Các lý do bị báo cáo</span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {selected.reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-2.5 text-xs text-amber-900">
                    <span className="font-bold">{report.category}:</span> {report.description}
                  </div>
                ))}
              </div>
            </div>

            {selected.reportCount > selected.reports.length && (
              <p className="text-xs text-slate-500 italic">
                Đang xử lý {selected.reports.length} báo cáo đã hiển thị; các báo cáo khác sẽ được giữ lại trong hàng đợi.
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="decision-reason" className="block text-xs font-bold text-slate-700">
                Lý do quyết định
              </label>
              <textarea
                id="decision-reason"
                aria-label="Lý do quyết định"
                className="block w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                maxLength={1000}
                rows={3}
                placeholder="Nhập lý do lưu hồ sơ xử lý (từ 3 ký tự)..."
                value={reason}
                disabled={mutation.isLoading}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={mutation.isLoading}
                onClick={() => setSelected(undefined)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={mutation.isLoading}
                onClick={() => void act(true)}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
              >
                Giữ lại
              </button>
              <button
                type="button"
                disabled={mutation.isLoading}
                onClick={() => void act(false)}
                className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 transition shadow-2xs cursor-pointer"
              >
                Gỡ bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {query.data && query.data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
          >
            Trang trước
          </button>
          <span className="text-xs font-bold text-slate-600">Trang {page}</span>
          <button
            type="button"
            disabled={page >= query.data.meta.totalPages || query.isFetching}
            onClick={() => setPage(page + 1)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
          >
            Trang sau
          </button>
        </div>
      )}
    </section>
  );
}
