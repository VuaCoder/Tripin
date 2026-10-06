'use client';

import React from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { EmptyState } from '@/components/shared';

export default function TravelerDashboardPage() {
  const user = useAppSelector(selectUser);

  return (
    <div className="flex flex-col gap-8 pb-12 animate-fadeInScale">
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
            Chào mừng bạn đến với bảng điều khiển du lịch cá nhân. Theo dõi các chuyến đi, đặt chỗ và ưu đãi của bạn.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/custom-trip"
            className="inline-flex items-center gap-2 bg-primary-container hover:bg-primary text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary-container/20 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            <span>Tạo tour riêng</span>
          </Link>
          <Link
            href="/explore"
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
            <div className="text-2xl font-bold text-slate-900">0</div>
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
          <h2 className="text-lg font-bold text-slate-900">Chuyến đi của bạn</h2>
          <Link href="/explore" className="text-xs font-semibold text-primary-container hover:underline">
            Tìm chuyến đi mới
          </Link>
        </div>

        <EmptyState
          title="Chưa có chuyến đi nào"
          description="Bạn chưa đặt phòng, vé xe hay tour nào. Hãy bắt đầu khám phá các điểm đến độc bản trên khắp Việt Nam!"
          actionLabel="Khám phá ngay"
          onAction={() => window.location.assign('/explore')}
        />
      </div>
    </div>
  );
}
