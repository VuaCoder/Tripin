'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { AntSelect, Button, Pagination, type AntSelectOption } from '@/components/ui';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { formatVnd } from '@/features/review';
import { useDecideCustomTourMutation, useListCustomToursQuery } from '../api';
import { STATUS_LABELS, guestSummary } from '../labels';
import { customTourHref } from '../links';
import type { CustomTourDecision, CustomTourRequestDto, CustomTourStatus } from '../types';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | CustomTourStatus;
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const dayShort = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const STATUS_OPTIONS: AntSelectOption<StatusFilter>[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  ...(Object.keys(STATUS_LABELS) as CustomTourStatus[]).map((status) => ({
    value: status,
    label: STATUS_LABELS[status].label,
  })),
];

export function AgencyCustomToursPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useListCustomToursQuery({
    page,
    limit: PAGE_SIZE,
    ...(status === 'ALL' ? {} : { status }),
  });
  const [decide] = useDecideCustomTourMutation();
  const items = data?.items ?? [];

  const decideRequest = async (id: string, decision: CustomTourDecision) => {
    setActionError(null);
    setPendingId(id);
    try {
      await decide({ id, decision }).unwrap();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Không thể cập nhật yêu cầu. Vui lòng thử lại.'));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Yêu cầu đoàn</h1>
        <AntSelect
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
          className="min-w-[180px]"
        />
      </header>

      {actionError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <LoadingState label="Đang tải yêu cầu đoàn..." />
      ) : isError ? (
        <ErrorState
          title="Không thể tải yêu cầu đoàn"
          message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
          onAction={() => void refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState title="Chưa có yêu cầu đoàn nào" description="Yêu cầu booking đoàn từ khách sẽ hiển thị tại đây." />
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {items.map((request: CustomTourRequestDto) => {
              const chip = STATUS_LABELS[request.status];
              const href = customTourHref(request, 'AGENCY');
              const showChat = Boolean(href) && (request.nextStep === 'NEGOTIATING' || Boolean(request.conversationId));
              const busy = pendingId === request.id;
              return (
                <li key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${chip.className}`}>
                      {chip.label}
                    </span>
                    <span className="text-xs text-slate-400">{dateTime.format(new Date(request.createdAt))}</span>
                  </div>

                  <div className="mt-3">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {request.sourceTour?.title ?? request.privateTour?.title ?? 'Tour riêng'}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">{guestSummary(request)}</p>
                    {request.startDate && (
                      <p className="mt-1 text-xs text-slate-500">Khởi hành dự kiến {dayShort.format(new Date(request.startDate))}</p>
                    )}
                    {request.notes && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{request.notes}</p>}
                    {request.offer && (
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        Tổng tạm tính: {formatVnd(request.offer.subtotal)}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-50 pt-3">
                    {request.status === 'SUBMITTED' && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void decideRequest(request.id, 'ACCEPT')}
                        >
                          Nhận
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void decideRequest(request.id, 'DECLINE')}
                        >
                          Từ chối
                        </Button>
                      </>
                    )}
                    {showChat && href && (
                      <Link
                        href={href}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Vào chat
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {data && data.meta.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={data.meta.totalPages}
              totalItems={data.meta.total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="yêu cầu"
            />
          )}
        </div>
      )}
    </div>
  );
}
