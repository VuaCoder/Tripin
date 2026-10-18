'use client';

import { useState, type FormEvent } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import {
  useGetMyEarningsQuery,
  useGetMyEarningsSummaryQuery,
} from '../api/earningsApi';
import {
  earningsDateRange,
  formatGuideDate,
  formatGuideMoney,
} from '../utils/finance';

export function GuideEarningsPage() {
  const user = useAppSelector(selectUser);
  return <EarningsContent key={user?.id ?? 'guest'} />;
}

export function EarningsContent() {
  const [dates, setDates] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [validationError, setValidationError] = useState('');
  const range = earningsDateRange(applied.from, applied.to);
  const list = useGetMyEarningsQuery(
    { ...range, page, limit: 10 },
    { refetchOnMountOrArgChange: true },
  );
  const summary = useGetMyEarningsSummaryQuery(range, {
    refetchOnMountOrArgChange: true,
  });
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (dates.from && dates.to && dates.from > dates.to) {
      setValidationError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
      return;
    }
    setValidationError('');
    setApplied(dates);
    setPage(1);
  };
  const filtered = Boolean(applied.from || applied.to);
  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Thu nhập</h1>
          <p className="mt-1 text-sm text-slate-500">
            Thu nhập ghi nhận từ các booking hoàn tất bạn nhận dẫn. Số liệu này
            không biểu thị tiền đã chuyển.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={list.isFetching || summary.isFetching}
          onClick={() => {
            void list.refetch();
            void summary.refetch();
          }}
        >
          Làm mới
        </Button>
      </header>
      <form
        onSubmit={apply}
        className="flex flex-wrap items-end gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"
      >
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Từ ngày
          <input
            type="date"
            value={dates.from}
            onChange={(e) => setDates({ ...dates, from: e.target.value })}
            className="rounded-xl border border-slate-200 p-2.5"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Đến ngày
          <input
            type="date"
            value={dates.to}
            onChange={(e) => setDates({ ...dates, to: e.target.value })}
            className="rounded-xl border border-slate-200 p-2.5"
          />
        </label>
        <Button type="submit">Áp dụng</Button>
        <Button
          variant="ghost"
          onClick={() => {
            setDates({ from: '', to: '' });
            setApplied({ from: '', to: '' });
            setPage(1);
            setValidationError('');
          }}
        >
          Xóa bộ lọc
        </Button>
        <p className="w-full text-xs text-slate-500">
          Ngày lọc và thời gian ghi nhận theo giờ Việt Nam (UTC+7).
        </p>
        {validationError && (
          <p role="alert" className="w-full text-sm text-red-700">
            {validationError}
          </p>
        )}
      </form>
      <section
        aria-label="Tổng hợp thu nhập"
        className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7"
      >
        {summary.isError ? (
          <ErrorState
            title="Không thể tải tổng hợp thu nhập"
            onAction={() => void summary.refetch()}
          />
        ) : !summary.currentData ? (
          <LoadingState label="Đang tải tổng hợp thu nhập..." />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">
                  Tổng thu nhập{filtered ? ' trong khoảng đã chọn' : ''}
                </p>
                <p className="mt-2 text-3xl font-extrabold text-teal-800">
                  {formatGuideMoney(summary.currentData.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Booking được ghi nhận</p>
                <p className="mt-2 text-3xl font-extrabold">
                  {summary.currentData.count}
                </p>
              </div>
            </div>
            {summary.currentData.byMonth.length > 0 && (
              <div className="mt-7">
                <h2 className="font-bold">Thu nhập theo tháng (UTC)</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="p-3">Tháng</th>
                        <th className="p-3">Số booking</th>
                        <th className="p-3 text-right">Thu nhập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.currentData.byMonth.map((month) => (
                        <tr
                          key={month.month}
                          className="border-b border-slate-50"
                        >
                          <td className="p-3">{month.month}</td>
                          <td className="p-3">{month.count}</td>
                          <td className="p-3 text-right font-semibold">
                            {formatGuideMoney(month.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <section
        aria-labelledby="earnings-history-heading"
        className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7"
      >
        <h2 id="earnings-history-heading" className="mb-4 text-lg font-bold">
          Lịch sử thu nhập
        </h2>
        {list.isError ? (
          <ErrorState
            title="Không thể tải lịch sử thu nhập"
            onAction={() => void list.refetch()}
          />
        ) : !list.currentData ? (
          <LoadingState label="Đang tải lịch sử thu nhập..." />
        ) : !list.currentData.items.length ? (
          <EmptyState
            title={
              filtered
                ? 'Không có thu nhập trong khoảng đã chọn'
                : 'Chưa có thu nhập'
            }
            description={
              filtered
                ? 'Thử thay đổi hoặc xóa bộ lọc ngày.'
                : 'Thu nhập sẽ được ghi nhận khi booking hoàn tất và bạn đã chấp nhận phân công tour.'
            }
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {list.currentData.items.map((earning) => (
                <article
                  key={earning.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <h3 className="break-words font-bold text-slate-900">
                      {earning.tour.title}
                    </h3>
                    <p className="mt-1 break-all text-sm text-slate-500">
                      Booking: {earning.bookingCode}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Ghi nhận: {formatGuideDate(earning.earnedAt)}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-teal-800">
                    {formatGuideMoney(earning.amount)}
                  </p>
                </article>
              ))}
            </div>
            <Pagination
              currentPage={list.currentData.meta.page}
              totalPages={list.currentData.meta.totalPages}
              totalItems={list.currentData.meta.total}
              onPageChange={setPage}
              disabled={list.isFetching}
              showInfo
              itemLabel="khoản thu nhập"
            />
          </>
        )}
      </section>
    </div>
  );
}
