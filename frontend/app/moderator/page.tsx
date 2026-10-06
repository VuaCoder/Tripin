'use client';

import React from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { EmptyState } from '@/components/shared';

export default function ModeratorDashboardPage() {
  const user = useAppSelector(selectUser);

  return (
    <div className="flex flex-col gap-8 pb-12 animate-fadeInScale">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 p-6 sm:p-8 border border-white/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100/70 border border-purple-200 text-purple-900 text-xs font-bold uppercase tracking-wider mb-3">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            Ban Kiểm Duyệt Nội Dung
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Xin chào, {user?.fullName || 'Kiểm duyệt viên'}!
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Trung tâm giám sát chất lượng sản phẩm du lịch, xác thực thông tin đối tác và xử lý báo cáo vi phạm cộng đồng.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 bg-white/90 px-3.5 py-2 rounded-xl border border-purple-100 shadow-sm">
            <span className="material-symbols-outlined text-[16px] text-purple-600">shield_person</span>
            Hệ thống ổn định
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Tour chờ duyệt</div>
          <div className="text-2xl font-bold text-slate-900">0</div>
          <div className="text-[11px] text-emerald-600 mt-1">Đã giải phóng hàng đợi</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Báo cáo vi phạm</div>
          <div className="text-2xl font-bold text-slate-900">0</div>
          <div className="text-[11px] text-slate-400 mt-1">Không có khiếu nại mới</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Đã duyệt tháng này</div>
          <div className="text-2xl font-bold text-slate-900">0</div>
          <div className="text-[11px] text-purple-600 mt-1">Chu kỳ hiện tại</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Thời gian phản hồi</div>
          <div className="text-2xl font-bold text-slate-900">&lt; 2h</div>
          <div className="text-[11px] text-teal-600 mt-1">Đạt chỉ tiêu SLA</div>
        </div>
      </div>

      {/* Moderation Queue Section */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Hàng đợi kiểm duyệt</h2>
            <p className="text-xs text-slate-500 mt-0.5">Danh sách các tour và đánh giá mới được gửi lên hệ thống</p>
          </div>
        </div>

        <EmptyState
          title="Không có mục nào cần xử lý"
          description="Tất cả sản phẩm du lịch và báo cáo vi phạm hiện đã được kiểm duyệt. Hệ thống sẽ tự động cập nhật khi có yêu cầu mới."
        />
      </div>
    </div>
  );
}
