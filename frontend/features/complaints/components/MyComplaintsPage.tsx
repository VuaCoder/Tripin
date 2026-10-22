'use client';

import { useState } from 'react';
import { Clock, MessageSquare, Star, User } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { useGetMyComplaintsQuery } from '../api/complaintsApi';
import { getCategoryLabel, PRIORITY_LABELS, STATUS_LABELS } from '../labels';
import type { ComplaintTicketStatus } from '../types';
import { ComplaintConversationView } from './ComplaintConversationView';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | ComplaintTicketStatus;
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export function MyComplaintsPage() {
  const user = useAppSelector(selectUser);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useGetMyComplaintsQuery({
    page,
    limit: PAGE_SIZE,
    ...(filter === 'ALL' ? {} : { status: filter }),
  });

  const items = data?.items ?? [];

  if (selectedTicketId) {
    return (
      <div className="h-[calc(100dvh-10rem)] min-h-[550px] flex flex-col min-h-0">
        <ComplaintConversationView
          ticketId={selectedTicketId}
          userRole="TRAVELER"
          userId={user?.id || ''}
          onBack={() => {
            setSelectedTicketId(null);
            void refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Khiếu nại dịch vụ tour của tôi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi tiến trình xử lý, trao đổi trực tiếp với đối tác tour và đánh giá chất lượng phục vụ sau khi đóng phiếu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Lọc theo trạng thái"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(STATUS_LABELS) as ComplaintTicketStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s].label}
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
            <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true">
              refresh
            </span>
          </button>
        </div>
      </header>

      {isLoading ? (
        <LoadingState label="Đang tải danh sách khiếu nại..." />
      ) : isError ? (
        <ErrorState
          title="Không thể tải danh sách khiếu nại"
          message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
          onAction={() => void refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có phiếu khiếu nại nào"
          description="Khi bạn có phản ánh hoặc khiếu nại về tour đã đi, phiếu sẽ hiển thị tại đây để bạn trao đổi với đối tác."
        />
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {items.map((ticket) => {
              const status = STATUS_LABELS[ticket.status];
              const priority = PRIORITY_LABELS[ticket.priority];
              return (
                <li
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-brand-teal hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-teal">{ticket.ticketCode}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${status.className}`}>
                        {status.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priority.className}`}>
                        {priority.label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Cập nhật: {dateTime.format(new Date(ticket.lastMessageAt))}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-brand-teal transition-colors">
                      {ticket.subject}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Tour: <span className="font-semibold text-slate-700">{ticket.tourTitle}</span>
                      {ticket.agencyName && ` · Đối tác: ${ticket.agencyName}`}
                      {ticket.bookingCode && ` · Mã đặt: ${ticket.bookingCode}`}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-50">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                      {getCategoryLabel(ticket.category)}
                    </span>

                    <div className="flex items-center gap-4">
                      {ticket.hasFeedback && ticket.rating && (
                        <span className="flex items-center gap-1 font-bold text-amber-500">
                          <Star className="size-3.5 fill-amber-400" />
                          {ticket.rating}/5 sao
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-slate-600 font-semibold">
                        <MessageSquare className="size-3.5" />
                        {ticket.messageCount} tin nhắn
                      </span>
                      <span className="text-brand-teal font-bold group-hover:underline">Xem hội thoại →</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {Boolean(data?.meta && data.meta.totalPages > 1) && (
            <div className="pt-2">
              <Pagination
                page={page}
                totalPages={data!.meta.totalPages}
                totalItems={data!.meta.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                itemLabel="khiếu nại"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
