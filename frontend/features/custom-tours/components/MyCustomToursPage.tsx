'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import { formatVnd } from '@/features/review';
import { useListCustomToursQuery } from '../api';
import { STATUS_LABELS, guestSummary } from '../labels';
import { customTourHref } from '../links';
import type { CustomTourRequestDto } from '../types';

const PAGE_SIZE = 10;
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const dayShort = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function ctaLabel(request: CustomTourRequestDto): string {
  if (request.nextStep === 'ENTER_PASSENGERS') return 'Nhập hành khách';
  if (request.nextStep === 'PAY' || request.nextStep === 'DONE') return 'Xem đơn';
  return 'Mở chat';
}

export function MyCustomToursPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useListCustomToursQuery({ page, limit: PAGE_SIZE });
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Yêu cầu đoàn của tôi</h1>

      {isLoading ? (
        <LoadingState label="Đang tải yêu cầu đoàn..." />
      ) : isError ? (
        <ErrorState
          title="Không thể tải yêu cầu đoàn"
          message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
          onAction={() => void refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có yêu cầu đoàn nào"
          description="Gửi yêu cầu booking đoàn từ trang tour để đại lý tư vấn và gửi thỏa thuận cho bạn."
        />
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {items.map((request) => {
              const status = STATUS_LABELS[request.status];
              const href = customTourHref(request, 'TRAVELER');
              return (
                <li key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${status.className}`}>
                      {status.label}
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

                  {href && (
                    <div className="mt-4 flex justify-end border-t border-slate-50 pt-3">
                      <Link
                        href={href}
                        className="inline-flex items-center rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-teal/90"
                      >
                        {ctaLabel(request)}
                      </Link>
                    </div>
                  )}
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
