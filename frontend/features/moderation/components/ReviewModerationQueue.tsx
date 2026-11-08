'use client';
import { useState } from 'react';
import { useReportedReviewsQuery, useTriageReviewMutation, type ReportedReview } from '../api/reviewTriageApi';
import { useModerationPermission, ModerationDenied, moderationErrorMessage } from './ModerationUi';
import { PERMISSION } from '../labels';

export function ReviewModerationQueue() {
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
    if (reason.trim().length < 3) { setError('Nhập lý do xử lý từ 3 ký tự.'); return; }
    try {
      await decide({ id: selected.id, contentVersion: selected.contentVersion, reportIds: selected.reports.map((report) => report.id), keep, reason: reason.trim() }).unwrap();
      setSelected(undefined); setReason(''); setError(''); void query.refetch();
    } catch (err) { setError(moderationErrorMessage(err, 'Nội dung hoặc báo cáo đã thay đổi. Tải lại trước khi quyết định.')); }
  }
  return <section className="space-y-4">
    <h1 className="text-2xl font-bold">Đánh giá bị báo cáo</h1>
    {query.isLoading && <p>Đang tải hàng đợi...</p>}
    {query.isError && <button onClick={() => void query.refetch()}>Không tải được hàng đợi. Thử lại</button>}
    {query.data?.items.length === 0 && <p>Không có báo cáo cần xử lý.</p>}
    {query.data?.items.map((review) => <article key={review.id} className="space-y-2 rounded-xl border p-4">
      <h2 className="font-semibold">{review.tourTitle} · {review.rating}/5 · {review.reportCount} báo cáo</h2>
      <p className="whitespace-pre-wrap">{review.comment}</p>
      <button onClick={() => { setSelected(review); setReason(''); setError(''); }}>Xem báo cáo và xử lý</button>
    </article>)}
    {selected && <div role="dialog" aria-label="Xử lý review bị báo cáo" className="space-y-3 rounded-xl border bg-slate-50 p-4">
      <p className="whitespace-pre-wrap">{selected.comment}</p>
      {selected.reports.map((report) => <p key={report.id}>{report.category}: {report.description}</p>)}
      {selected.reportCount > selected.reports.length && <p>Đang xử lý {selected.reports.length} báo cáo đã hiển thị; các báo cáo khác sẽ được giữ lại trong hàng đợi.</p>}
      <label>Lý do quyết định<textarea className="block w-full rounded border p-2" maxLength={1000} value={reason} disabled={mutation.isLoading} onChange={(event) => setReason(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-3"><button disabled={mutation.isLoading} onClick={() => void act(true)}>Giữ lại</button><button disabled={mutation.isLoading} onClick={() => void act(false)}>Gỡ bỏ</button><button disabled={mutation.isLoading} onClick={() => setSelected(undefined)}>Đóng</button></div>
    </div>}
    {query.data && <div className="flex gap-4"><button disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button disabled={page >= query.data.meta.totalPages || query.isFetching} onClick={() => setPage(page + 1)}>Trang sau</button></div>}
  </section>;
}
