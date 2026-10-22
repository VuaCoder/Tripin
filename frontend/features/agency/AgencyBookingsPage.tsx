'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  RotateCw, 
  RotateCcw, 
  Filter, 
  Layers, 
  Compass, 
  Calendar, 
  ChevronDown, 
  Ticket,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useGetAgencyBookingQuery, useGetAgencyBookingsQuery } from '@/features/booking/api/bookingApi';
import { useGetAgencyToursQuery, getTourApiMessage } from '@/features/tours/api/toursApi';
import type { BookingStatus } from '@/features/booking/types';
import type { AgencyBookingFilters } from './types';
import { AgencyDenied, AgencyError, AgencyLoading, agencyButton, agencyPanel, bookingStatusNames, dateTime, money, useAgencyPermission } from './AgencyUi';
import { Pagination, AntSelect, AntDatePicker } from '@/components/ui';

export function AgencyBookingsPage() {
  const params = useSearchParams();
  const canView = useAgencyPermission('agency:bookings-view');
  const canViewTours = useAgencyPermission('tour:update-own');
  const [filters, setFilters] = useState({ status: '', tourId: params.get('tourId') ?? '', from: '', to: '' });
  const [tourPage, setTourPage] = useState(1);
  const [tourFilterOpened, setTourFilterOpened] = useState(false);
  const [tourSearch, setTourSearch] = useState('');
  const [debouncedTourSearch, setDebouncedTourSearch] = useState('');
  const [selectedTourTitle, setSelectedTourTitle] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTourSearch(tourSearch.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [tourSearch]);
  const validDates = !filters.from || !filters.to || filters.from <= filters.to;
  const query: AgencyBookingFilters = { page, limit: 20, ...(filters.status ? { status: filters.status as BookingStatus } : {}), ...(filters.tourId ? { tourId: filters.tourId } : {}), ...(filters.from ? { departureFrom: `${filters.from}T00:00:00.000Z` } : {}), ...(filters.to ? { departureTo: `${filters.to}T23:59:59.999Z` } : {}) };
  const { currentData: data, isLoading, isFetching, error, refetch } = useGetAgencyBookingsQuery(query, { skip: !canView || !validDates, refetchOnFocus: true, refetchOnReconnect: true });
  const tours = useGetAgencyToursQuery(
    { page: tourPage, limit: 12, ...(debouncedTourSearch ? { q: debouncedTourSearch } : {}) },
    { skip: !canView || !canViewTours || !tourFilterOpened },
  );
  const tourSearchPending = tourSearch.trim() !== debouncedTourSearch;
  const update = (key: keyof typeof filters, value: string) => { setFilters((previous) => ({ ...previous, [key]: value })); setPage(1); };
  const clearFilters = () => { setFilters({ status: '', tourId: '', from: '', to: '' }); setSelectedTourTitle(''); setPage(1); };
  const hasActiveFilters = Boolean(filters.status || filters.tourId || filters.from || filters.to);

  if (!canView) return <AgencyDenied />;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-sky-50 text-sky-700 border border-sky-200/80';
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border border-rose-200/80';
      case 'PENDING':
      default:
        return 'bg-amber-50 text-amber-700 border border-amber-200/80';
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header with Title and Modern Icon Refresh Button */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Booking của Agency</h1>
          <p className="mt-1 text-sm text-slate-600">Theo dõi đặt chỗ và trạng thái thanh toán thuộc tour của bạn.</p>
        </div>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50 transition-all group"
          disabled={isFetching || !validDates}
          onClick={() => void refetch()}
          aria-label="Làm mới"
          title="Làm mới"
        >
          <RotateCw size={18} className={isFetching ? 'animate-spin text-teal-600' : 'text-slate-600 transition-transform group-hover:rotate-45'} />
        </button>
      </header>

      {/* Styled, Perfectly Aligned Filter Controls */}
      <section aria-label="Bộ lọc booking" className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
            <Filter size={16} className="text-teal-600" />
            <span>Bộ lọc tìm kiếm</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* 1. Trạng thái */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="booking-status">
              Trạng thái
            </label>
            <AntSelect
              value={filters.status}
              onChange={(value) => update('status', value)}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                ...Object.entries(bookingStatusNames).map(([val, label]) => ({ value: val, label })),
              ]}
              prefix={<Layers size={17} />}
              className="w-full"
              size="large"
            />
          </div>

          {/* 2. Tour */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="booking-tour">
              Tour
            </label>
            {canViewTours ? (
              <AntSelect
                value={filters.tourId}
                onOpen={() => setTourFilterOpened(true)}
                onChange={(value) => {
                  setSelectedTourTitle(tours.currentData?.items.find((tour) => tour.id === value)?.title ?? '');
                  update('tourId', value);
                }}
                options={[
                  { value: '', label: 'Tất cả tour' },
                  ...(filters.tourId && !tours.currentData?.items.some((tour) => tour.id === filters.tourId)
                    ? [{ value: filters.tourId, label: selectedTourTitle || 'Tour đang chọn' }]
                    : []),
                  ...(!tourSearchPending ? tours.currentData?.items.map((tour) => ({ value: tour.id, label: tour.title })) ?? [] : []),
                ]}
                prefix={<Compass size={17} />}
                className="w-full"
                size="large"
              />
            ) : (
              <div className="relative flex items-center h-11 w-full rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                <Compass size={17} className="pointer-events-none absolute left-3.5 text-slate-400" />
                <input
                  id="booking-tour"
                  className="h-full w-full bg-transparent pl-10 pr-3.5 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="ID tour (không bắt buộc)"
                  value={filters.tourId}
                  onChange={(event) => update('tourId', event.target.value)}
                />
              </div>
            )}
            {canViewTours && tourFilterOpened && (
              <input
                type="search"
                aria-label="Tìm tour theo tên"
                value={tourSearch}
                maxLength={100}
                onChange={(event) => { setTourSearch(event.target.value); setTourPage(1); }}
                placeholder="Tìm tour theo tên..."
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
              />
            )}
            {canViewTours && tourFilterOpened && tours.isFetching && <p className="text-xs text-slate-500">Đang tải tour...</p>}
            {canViewTours && tourFilterOpened && !tourSearchPending && tours.currentData && tours.currentData.meta.totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5 px-1">
                <button
                  type="button"
                  disabled={tourPage <= 1}
                  onClick={() => setTourPage((v) => v - 1)}
                  className="hover:text-teal-700 disabled:opacity-40 font-semibold cursor-pointer"
                >
                  ← Trước
                </button>
                <span>Nhóm tour {tourPage}/{tours.currentData.meta.totalPages}</span>
                <button
                  type="button"
                  disabled={tourPage >= tours.currentData.meta.totalPages}
                  onClick={() => setTourPage((v) => v + 1)}
                  className="hover:text-teal-700 disabled:opacity-40 font-semibold cursor-pointer"
                >
                  Sau →
                </button>
              </div>
            )}
            {canViewTours && tourFilterOpened && tours.error && (
              <p role="alert" className="text-xs text-red-700">
                Không tải được tour. <button type="button" onClick={() => void tours.refetch()} className="underline font-semibold">Thử lại</button>
              </p>
            )}
          </div>

          {/* 3. Khởi hành từ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="booking-from">
              Khởi hành từ (UTC)
            </label>
            <AntDatePicker
              id="booking-from"
              value={filters.from}
              onChange={(date) => update('from', date)}
              placeholder="Chọn ngày bắt đầu"
              className="w-full"
              size="large"
            />
          </div>

          {/* 4. Đến hết ngày */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="booking-to">
              Đến hết ngày (UTC)
            </label>
            <AntDatePicker
              id="booking-to"
              value={filters.to}
              onChange={(date) => update('to', date)}
              placeholder="Chọn ngày kết thúc"
              className="w-full"
              size="large"
            />
          </div>
        </div>
      </section>

      {/* Booking List / Modern Colorful Empty State */}
      {!validDates ? (
        <p role="alert" className="text-sm font-semibold text-red-700 bg-red-50 p-4 rounded-xl border border-red-200">
          Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
        </p>
      ) : isLoading || (!data && isFetching) ? (
        <AgencyLoading />
      ) : error ? (
        <AgencyError message={getTourApiMessage(error, 'Không tải được booking hoặc bạn không có quyền truy cập.')} retry={() => void refetch()} />
      ) : data && (
        <section className={`${agencyPanel} space-y-4`} aria-busy={isFetching}>
          {data.items.length === 0 ? (
            /* Modern, colorful, inviting empty state card */
            <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/70 via-white to-sky-50/50 p-10 sm:p-14 text-center shadow-xs flex flex-col items-center justify-center my-2">
              <div className="relative mb-5 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 text-white shadow-xl shadow-teal-600/20 ring-8 ring-teal-50/80">
                <Ticket size={36} strokeWidth={1.8} />
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 text-[10px] font-black">
                  0
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Chưa có đơn đặt chỗ nào phù hợp</h3>
              <p className="mt-2.5 max-w-md text-sm text-slate-600 leading-relaxed">
                Hệ thống không tìm thấy booking nào khớp với bộ lọc đang chọn. Hãy thử thay đổi khoảng ngày khởi hành hoặc chọn tất cả trạng thái.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 active:scale-98 transition-all cursor-pointer"
                >
                  <RotateCcw size={15} />
                  <span>Đặt lại toàn bộ bộ lọc</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200/60 px-3 py-1 rounded-full">
                  <Ticket size={13} /> {data.meta.total} booking phù hợp
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500 text-xs uppercase font-bold tracking-wider">
                      {['Booking', 'Tour', 'Khởi hành', 'Số khách', 'Trạng thái', 'Thanh toán', 'Tổng tiền'].map((label) => (
                        <th key={label} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((booking) => (
                      <tr key={booking.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3 py-4">
                          <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/agency/bookings/${booking.id}`}>
                            {booking.bookingCode}
                          </Link>
                        </td>
                        <td className="min-w-48 px-3 py-4 font-medium text-slate-800">{booking.tour.title}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-slate-600">{dateTime(booking.departureDate)}</td>
                        <td className="px-3 py-4 font-semibold text-slate-700">{booking.participants}</td>
                        <td className="whitespace-nowrap px-3 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadge(booking.status)}`}>
                            {bookingStatusNames[booking.status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${booking.isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-amber-50 text-amber-700 border border-amber-200/80'}`}>
                            {booking.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 font-bold text-slate-900 tabular-nums">
                          {money(booking.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Shared Modern Pagination */}
              <Pagination
                currentPage={data.meta.page}
                totalPages={data.meta.totalPages}
                totalItems={data.meta.total}
                pageSize={20}
                itemLabel="booking"
                onPageChange={(newPage) => setPage(newPage)}
                disabled={isFetching}
              />
            </>
          )}
        </section>
      )}
    </main>
  );
}

export function AgencyBookingDetailPage({ id }: { id: string }) {
  const canView = useAgencyPermission('agency:bookings-view');
  const canViewTours = useAgencyPermission('tour:update-own');
  const { data: booking, isLoading, error, refetch } = useGetAgencyBookingQuery(id, { skip: !canView, refetchOnFocus: true });
  if (!canView) return <AgencyDenied />;
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6"><Link href="/agency/bookings" className="text-sm font-semibold text-primary hover:underline">← Booking của Agency</Link>{isLoading ? <AgencyLoading /> : error || !booking ? <AgencyError message={getTourApiMessage(error, 'Không tìm thấy booking hoặc bạn không có quyền truy cập.')} retry={() => void refetch()} /> : <>
    <header><h1 className="text-2xl font-bold text-slate-900">{booking.bookingCode}</h1><p className="mt-2 text-sm text-slate-600">{bookingStatusNames[booking.status]} · {booking.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}</p></header>
    <section className={agencyPanel}><h2 className="mb-4 text-lg font-semibold">Thông tin đặt chỗ</h2><dl className="grid gap-5 sm:grid-cols-2">{[['Tour', booking.tour.title], ['Ngày khởi hành', dateTime(booking.departureDate)], ['Số khách', booking.participants], ['Ngày đặt', dateTime(booking.createdAt)], ['Tổng thanh toán', money(booking.totalAmount)], ['Hoa hồng nền tảng', money(booking.commissionAmount)], ['Agency nhận', money(booking.agencyAmount)], ...(booking.confirmedAt ? [['Ngày xác nhận', dateTime(booking.confirmedAt)]] : []), ...(booking.cancelledAt ? [['Ngày hủy', dateTime(booking.cancelledAt)]] : [])].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd></div>)}</dl>{canViewTours && <Link href={`/agency/tours/${booking.tour.id}`} className={`${agencyButton} mt-5`}>Xem tour / xuất danh sách khách</Link>}</section>
    <section className={agencyPanel}><h2 className="mb-4 text-lg font-semibold">Liên hệ khách hàng</h2>{booking.traveler ? <dl className="space-y-3 text-sm"><div><dt className="text-slate-500">Họ tên</dt><dd className="font-medium">{booking.traveler.fullName}</dd></div><div><dt className="text-slate-500">Điện thoại</dt><dd>{booking.traveler.phone}</dd></div>{booking.notes && <div><dt className="text-slate-500">Ghi chú</dt><dd className="whitespace-pre-wrap break-words">{booking.notes}</dd></div>}</dl> : <p className="text-sm text-slate-600">Thông tin liên hệ chỉ được chia sẻ khi booking đã xác nhận hoặc hoàn thành.</p>}</section>
  </>}</main>;
}
