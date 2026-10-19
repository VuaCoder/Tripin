'use client';

import React from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { EmptyState, LoadingState } from '@/components/shared';
import { useGetMyBookingsQuery, BookingStatusBadge } from '@/features/booking';
import { formatDepartureDate, formatParticipants, formatVnd } from '@/lib/travel-format';

export default function TravelerDashboardPage() {
  const user = useAppSelector(selectUser);
  const { data: bookingsData, isLoading } = useGetMyBookingsQuery({ limit: 5 });

  const activeBookingsCount =
    bookingsData?.items.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING').length ?? 0;

  return (
    <div className="flex flex-col gap-8 pb-12 animate-fadeInScale max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-low p-6 sm:p-8 border border-white/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-primary-container text-xs font-bold uppercase tracking-wider mb-3">
            <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
            Tài khoản Du khách
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Xin chào, {user?.fullName || 'Quý khách'}!
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Chào mừng bạn đến với bảng điều khiển du lịch cá nhân. Theo dõi các chuyến đi, đặt chỗ và quản lý thanh toán.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/settings/history"
            className="inline-flex items-center gap-2 bg-primary-container hover:bg-primary text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-primary-container/20 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Đặt chỗ của tôi</span>
          </Link>
          <Link
            href="/tours"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 transition-all"
          >
            <span>Khám phá dịch vụ</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-primary-container">
            <span className="material-symbols-outlined text-2xl">event_available</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{activeBookingsCount}</div>
            <div className="text-xs text-slate-500 font-medium">Chuyến đi đang hoạt động</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <span className="material-symbols-outlined text-2xl">favorite</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">0</div>
            <div className="text-xs text-slate-500 font-medium">Điểm đến đã lưu</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <span className="material-symbols-outlined text-2xl">stars</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">100</div>
            <div className="text-xs text-slate-500 font-medium">Điểm tích lũy Tripri</div>
          </div>
        </div>
      </div>

      {/* Bookings / Trips Section */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Chuyến đi gần đây của bạn</h2>
            <p className="text-xs text-slate-500">Các tour du lịch bạn đã tạo đơn hoặc thanh toán gần đây</p>
          </div>
          <Link
            href="/settings/history"
            className="text-xs font-bold text-primary-container hover:underline inline-flex items-center gap-1"
          >
            <span>Xem tất cả ({bookingsData?.meta.total ?? 0})</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-100 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-20 rounded bg-slate-200" />
                    <div className="h-5 w-24 rounded-full bg-slate-200" />
                  </div>
                  <div className="h-4 w-3/4 max-w-sm rounded bg-slate-200" />
                  <div className="h-3 w-40 rounded bg-slate-100" />
                </div>
                <div className="h-5 w-24 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : !bookingsData || bookingsData.items.length === 0 ? (
          <EmptyState
            title="Chưa có chuyến đi nào"
            description="Bạn chưa đặt phòng, vé xe hay tour nào. Hãy bắt đầu khám phá các điểm đến độc bản trên khắp Việt Nam!"
            actionLabel="Khám phá ngay"
            onAction={() => window.location.assign('/tours')}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {bookingsData.items.map((booking) => (
              <div
                key={booking.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {booking.bookingCode}
                    </span>
                    <BookingStatusBadge
                      status={booking.status}
                      isPaid={booking.isPaid}
                      refundRequired={booking.refundRequired}
                    />
                  </div>
                  <Link
                    href={`/settings/history/${booking.id}`}
                    className="text-sm font-bold text-slate-900 hover:text-primary-container transition-colors block line-clamp-1"
                  >
                    {booking.tour.title}
                  </Link>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{formatDepartureDate(booking.departureDate)}</span>
                    <span>•</span>
                    <span>{formatParticipants(booking.participants)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-extrabold text-primary-container">
                      {formatVnd(booking.totalAmount)}
                    </div>
                  </div>
                  <Link
                    href={`/settings/history/${booking.id}`}
                    className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Chi tiết
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
