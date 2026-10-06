'use client';

import React from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { EmptyState } from '@/components/shared';

const UPCOMING_FEATURES = [
  {
    icon: 'map',
    label: 'Quản lý tour và lịch trình nhận khách',
    desc: 'Xem chi tiết danh sách đoàn, điểm đón trả và phân công dẫn tour',
  },
  {
    icon: 'calendar_month',
    label: 'Theo dõi lịch đặt tour của du khách',
    desc: 'Đồng bộ lịch cá nhân và nhận thông báo khi có phân công tour mới',
  },
  {
    icon: 'payments',
    label: 'Thống kê thu nhập và đánh giá',
    desc: 'Xem phản hồi từ du khách và quản lý thu nhập chuyến đi',
  },
];

export default function GuideDashboardPage() {
  const user = useAppSelector(selectUser);

  return (
    <div className="flex flex-col gap-8 pb-12 animate-fadeInScale">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-50 via-emerald-50 to-slate-50 p-6 sm:p-8 border border-white/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100/70 border border-teal-200 text-brand-teal text-xs font-bold uppercase tracking-wider mb-3">
            <span className="material-symbols-outlined text-[16px]">explore</span>
            Cổng Hướng Dẫn Viên
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Xin chào, {user?.fullName || 'Hướng dẫn viên'}!
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Chúc bạn một ngày làm việc tuyệt vời và mang lại những trải nghiệm đáng nhớ nhất cho du khách trên từng cung đường.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-white/90 px-3.5 py-2 rounded-xl border border-teal-100 shadow-sm">
            <span className="material-symbols-outlined text-[16px] text-teal-600">verified</span>
            Sẵn sàng nhận tour
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal">
            <span className="material-symbols-outlined text-2xl">flag</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">0</div>
            <div className="text-xs text-slate-500 font-medium">Tour đang phụ trách</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <span className="material-symbols-outlined text-2xl">calendar_today</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">0</div>
            <div className="text-xs text-slate-500 font-medium">Lịch dẫn sắp tới</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <span className="material-symbols-outlined text-2xl">star</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">5.0</div>
            <div className="text-xs text-slate-500 font-medium">Đánh giá trung bình</div>
          </div>
        </div>
      </div>

      {/* Schedule / Tours Section */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">Lịch trình tour gần nhất</h2>
        </div>

        <EmptyState
          title="Chưa có lịch dẫn tour nào"
          description="Bạn chưa được phân công hoặc chưa nhận tour mới nào trong tuần này. Vui lòng kiểm tra lại sau hoặc liên hệ đại lý đối tác."
        />
      </div>

      {/* Upcoming features roadmap */}
      <div className="rounded-3xl bg-slate-50/70 border border-slate-100 p-6 sm:p-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Tính năng đang hoàn thiện cho Hướng dẫn viên
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {UPCOMING_FEATURES.map((feature) => (
            <div
              key={feature.icon}
              className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col gap-2"
            >
              <div className="w-9 h-9 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">{feature.icon}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-1">{feature.label}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
