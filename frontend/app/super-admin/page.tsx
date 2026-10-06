'use client';

import React from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { EmptyState } from '@/components/shared';

export default function SuperAdminDashboardPage() {
  const user = useAppSelector(selectUser);

  return (
    <div className="flex flex-col gap-8 pb-12 animate-fadeInScale">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-rose-50 via-slate-50 to-orange-50 p-6 sm:p-8 border border-white/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100/70 border border-rose-200 text-rose-900 text-xs font-bold uppercase tracking-wider mb-3">
            <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            Quản Trị Viên Cấp Cao
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Bảng điều khiển Trung tâm Quản trị
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Xin chào {user?.fullName || 'Quản trị viên'}. Quản trị toàn diện người dùng, phân quyền hệ thống và theo dõi nhật ký hoạt động Tripri.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-white/90 px-3.5 py-2 rounded-xl border border-emerald-100 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Hệ thống trực tuyến
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Tổng người dùng</div>
          <div className="text-2xl font-bold text-slate-900">--</div>
          <div className="text-[11px] text-slate-400 mt-1">Đồng bộ từ cơ sở dữ liệu</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Đại lý đối tác</div>
          <div className="text-2xl font-bold text-slate-900">--</div>
          <div className="text-[11px] text-teal-600 mt-1">Đang hoạt động</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Hướng dẫn viên</div>
          <div className="text-2xl font-bold text-slate-900">--</div>
          <div className="text-[11px] text-blue-600 mt-1">Đã xác minh danh tính</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Nhật ký sự kiện (24h)</div>
          <div className="text-2xl font-bold text-slate-900">0 cảnh báo</div>
          <div className="text-[11px] text-emerald-600 mt-1">Bảo mật bình thường</div>
        </div>
      </div>

      {/* Admin Audit & Management Section */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nhật ký kiểm toán hệ thống (Audit Logs)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Theo dõi lịch sử thay đổi quyền hạn và thao tác quản trị</p>
          </div>
        </div>

        <EmptyState
          title="Chưa có sự kiện kiểm toán mới"
          description="Các thao tác đăng nhập quản trị và cập nhật cấu hình quan trọng sẽ được lưu vết chi tiết tại đây."
        />
      </div>
    </div>
  );
}
