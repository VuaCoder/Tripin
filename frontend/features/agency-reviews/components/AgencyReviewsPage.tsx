'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import { useAppSelector } from '@/store/hooks';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import { selectUser } from '@/features/auth';
import { REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS, ReportDialog } from '@/features/report';
import type { CreateReportInput } from '@/features/report';
import { RatingStars } from '@/features/review/components';
import { useDisputeReviewMutation, useGetAgencyReviewsQuery, useGetMyReviewDisputesQuery } from '../api/agencyReviewsApi';
import { DISPUTE_ERROR_MESSAGES } from '../labels';
import type { AgencyReview, ReviewDispute } from '../types';

const PAGE_SIZE = 10;
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const DISPUTE_HINT =
  'Phản ánh của bạn được gửi tới kiểm duyệt viên để kiểm tra. Đánh giá vẫn hiển thị cho tới khi có quyết định.';

/** Use case "Dispute a review": the reviews of this agency's tours, and the disputes it filed about them. */
export function AgencyReviewsPage() {
  const agencyId = useAppSelector(selectUser)?.id ?? '';

  const [page, setPage] = useState(1);
  const reviews = useGetAgencyReviewsQuery({ agencyId, page, limit: PAGE_SIZE }, { skip: !agencyId });
  const [disputePage, setDisputePage] = useState(1);
  const disputes = useGetMyReviewDisputesQuery({ page: disputePage, limit: PAGE_SIZE });
  const [disputeReview, { isLoading: isSubmitting }] = useDisputeReviewMutation();

  const [target, setTarget] = useState<AgencyReview | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const submitDispute = async (input: CreateReportInput) => {
    if (!target) return;
    setServerError(null);
    try {
      await disputeReview({ reviewId: target.id, category: input.category, description: input.description }).unwrap();
      setFeedback({ message: 'Đã gửi phản ánh tới kiểm duyệt viên.', type: 'success' });
      setTarget(null);
      setDisputePage(1);
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      setServerError((code && DISPUTE_ERROR_MESSAGES[code]) || getApiErrorMessage(err, 'Không thể gửi phản ánh lúc này. Vui lòng thử lại.'));
      void reviews.refetch();
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Đánh giá về tour của tôi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Đánh giá của du khách về các tour của bạn. Nếu một đánh giá sai sự thật, hãy phản ánh để kiểm duyệt viên kiểm tra.
        </p>
      </header>

      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold ${
            feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Đóng thông báo" className="text-slate-500 hover:text-slate-700">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      )}

      <section className="space-y-3">
        {reviews.isLoading ? (
          <LoadingState label="Đang tải đánh giá..." />
        ) : reviews.isError ? (
          <ErrorState title="Không thể tải đánh giá" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void reviews.refetch()} />
        ) : !reviews.data || reviews.data.items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8">
            <EmptyState title="Chưa có đánh giá nào" description="Các tour của bạn chưa có đánh giá nào đang hiển thị." />
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {reviews.data.items.map((review) => (
                <li key={review.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <RatingStars value={review.rating} size="sm" />
                        <span className="text-sm font-semibold text-slate-800">{review.author.name}</span>
                        <span className="text-xs text-slate-500">{dateTime.format(new Date(review.createdAt))}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{review.comment}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setServerError(null);
                        setTarget(review);
                      }}
                      className="rounded-xl border border-purple-200 px-3 py-1.5 text-sm font-semibold text-purple-800 hover:bg-purple-50"
                    >
                      Phản ánh đánh giá
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              currentPage={reviews.data.meta.page}
              totalPages={reviews.data.meta.totalPages}
              totalItems={reviews.data.meta.total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              disabled={reviews.isFetching}
              showInfo
              itemLabel="đánh giá"
            />
          </>
        )}
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-bold text-slate-900">Phản ánh tôi đã gửi</h2>
        {disputes.isLoading ? (
          <LoadingState label="Đang tải phản ánh..." />
        ) : disputes.isError ? (
          <ErrorState title="Không thể tải phản ánh" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void disputes.refetch()} />
        ) : !disputes.data || disputes.data.items.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Bạn chưa gửi phản ánh nào.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {disputes.data.items.map((dispute) => {
                const label = REPORT_STATUS_LABELS[dispute.status];
                return (
                  <li key={dispute.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${label.className}`}>{label.label}</span>
                      <span className="text-xs font-semibold text-slate-600">{REPORT_CATEGORY_LABELS[dispute.category]}</span>
                      <span className="text-xs text-slate-500">Gửi {dateTime.format(new Date(dispute.createdAt))}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{dispute.description}</p>
                    {dispute.resolution && (
                      <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-xs font-bold text-emerald-800">
                          Quyết định của kiểm duyệt viên ({dispute.resolution.decision === 'RESOLVED' ? 'chấp nhận' : 'bác bỏ'}) ·{' '}
                          {dateTime.format(new Date(dispute.resolution.resolvedAt))}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{dispute.resolution.note}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination
              currentPage={disputes.data.meta.page}
              totalPages={disputes.data.meta.totalPages}
              totalItems={disputes.data.meta.total}
              pageSize={PAGE_SIZE}
              onPageChange={setDisputePage}
              disabled={disputes.isFetching}
              showInfo
              itemLabel="phản ánh"
            />
          </>
        )}
      </section>

      <ReportDialog
        open={Boolean(target)}
        targetType="REVIEW"
        targetId={target?.id ?? ''}
        targetLabel={target ? `Đánh giá ${target.rating}★ của ${target.author.name}` : undefined}
        title="Phản ánh đánh giá"
        hint={DISPUTE_HINT}
        isSubmitting={isSubmitting}
        serverError={serverError}
        onClose={() => {
          setTarget(null);
          setServerError(null);
        }}
        onSubmit={(input) => void submitDispute(input)}
      />
    </div>
  );
}
