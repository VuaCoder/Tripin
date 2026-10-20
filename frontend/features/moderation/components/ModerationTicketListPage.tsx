'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import {
  useGetModerationTicketQuery,
  useGetModerationTicketsQuery,
  useReplyToModerationTicketMutation,
  useSetModerationTicketStatusMutation,
} from '../api/moderationApi';
import { PERMISSION, TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS } from '../labels';
import type { TicketCategory, TicketStatus } from '../types';
import { dateTime, FeedbackBanner, ModerationDenied, moderationErrorMessage, useModerationPermission, type Feedback } from './ModerationUi';
import { TicketReplyDialog } from './TicketReplyDialog';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | TicketStatus;
type CategoryFilter = 'ALL' | TicketCategory;

const SELECT_CLASS = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';

/** Use case "Handle complaints": the support queue of the platform. */
export function ModerationTicketListPage() {
  const canHandle = useModerationPermission(PERMISSION.complaintHandle);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const { data, isLoading, isFetching, isError, refetch } = useGetModerationTicketsQuery(
    {
      page,
      limit: PAGE_SIZE,
      ...(status === 'ALL' ? {} : { status }),
      ...(category === 'ALL' ? {} : { category }),
    },
    { skip: !canHandle },
  );
  const [reply, { isLoading: isReplying }] = useReplyToModerationTicketMutation();
  const [changeTicketStatus, { isLoading: isSettingStatus }] = useSetModerationTicketStatusMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // The list row has no conversation, so the detail is read for the selected ticket.
  const {
    data: ticket,
    isLoading: isLoadingTicket,
    isError: isTicketError,
    refetch: refetchTicket,
  } = useGetModerationTicketQuery(selectedId ?? '', {
    skip: !canHandle || !selectedId,
  });

  if (!canHandle) return <ModerationDenied />;

  const close = () => {
    setSelectedId(null);
    setServerError(null);
  };

  // The UI only reports success after the backend has confirmed (`unwrap` throws on any error).
  const run = async (call: () => Promise<unknown>, successMessage: string, failure: string) => {
    setServerError(null);
    try {
      await call();
      setFeedback({ message: successMessage, type: 'success' });
      close();
    } catch (err: unknown) {
      setServerError(moderationErrorMessage(err, failure));
      // The ticket may have been closed or answered elsewhere; re-read both the queue and the conversation.
      void refetch();
      void refetchTicket();
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-1 py-2 sm:px-0">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Khiếu nại hỗ trợ</h1>
          <p className="mt-1 text-sm text-slate-500">
            Yêu cầu hỗ trợ do du khách gửi. Trả lời để chuyển sang “Đang xử lý”, hoặc đánh dấu đã giải quyết khi xong.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            className={SELECT_CLASS}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_LABELS[s].label}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc theo loại yêu cầu"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as CategoryFilter);
              setPage(1);
            }}
            className={SELECT_CLASS}
          >
            <option value="ALL">Mọi loại yêu cầu</option>
            {(Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[]).map((c) => (
              <option key={c} value={c}>
                {TICKET_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
            aria-label="Làm mới"
            title="Làm mới"
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true">refresh</span>
          </button>
        </div>
      </header>

      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {isLoading ? (
        <LoadingState label="Đang tải danh sách khiếu nại..." />
      ) : isError ? (
        <ErrorState title="Không thể tải danh sách khiếu nại" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <EmptyState title="Không có khiếu nại nào" description="Không có khiếu nại hỗ trợ nào khớp với bộ lọc hiện tại." />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {data.items.map((t) => {
              const label = TICKET_STATUS_LABELS[t.status];
              return (
                <li key={t.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${label.className}`}>{label.label}</span>
                        <span className="text-xs font-semibold text-slate-600">{TICKET_CATEGORY_LABELS[t.category]}</span>
                        <span className="text-xs text-slate-400">{t.messageCount} tin nhắn</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{t.subject}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Tin nhắn cuối {dateTime.format(new Date(t.lastMessageAt))} · Mở {dateTime.format(new Date(t.createdAt))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setServerError(null);
                        setSelectedId(t.id);
                      }}
                      className="rounded-xl border border-purple-200 px-3 py-1.5 text-sm font-semibold text-purple-800 hover:bg-purple-50"
                    >
                      {t.status === 'OPEN' || t.status === 'IN_PROGRESS' ? 'Xem & xử lý' : 'Xem chi tiết'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination currentPage={data.meta.page} totalPages={data.meta.totalPages} totalItems={data.meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={isFetching} showInfo itemLabel="khiếu nại" />
        </div>
      )}

      <TicketReplyDialog
        open={Boolean(selectedId)}
        ticket={ticket ?? null}
        isLoading={isLoadingTicket}
        isError={isTicketError}
        onRetry={() => void refetchTicket()}
        isSubmitting={isReplying || isSettingStatus}
        serverError={serverError}
        onClose={close}
        onReply={(input) =>
          void run(
            () => reply({ id: selectedId!, text: input.text, ...(input.resolve ? { resolve: true } : {}) }).unwrap(),
            'Đã gửi trả lời cho du khách.',
            'Không thể gửi trả lời lúc này. Vui lòng thử lại.',
          )
        }
        onSetStatus={(next) =>
          void run(
            () => changeTicketStatus({ id: selectedId!, status: next }).unwrap(),
            next === 'RESOLVED' ? 'Đã đánh dấu khiếu nại là đã giải quyết.' : 'Đã tiếp nhận xử lý khiếu nại.',
            'Không thể đổi trạng thái khiếu nại lúc này. Vui lòng thử lại.',
          )
        }
      />
    </div>
  );
}
