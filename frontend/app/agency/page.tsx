'use client';

import React from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { EmptyState } from '@/components/shared';

export default function AgencyDashboardPage() {
  const user = useAppSelector(selectUser);

  return (
    <div className="flex flex-col gap-8 pb-12 animate-fadeInScale">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-50 via-slate-50 to-teal-50 p-6 sm:p-8 border border-white/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 border border-blue-200 text-blue-900 text-xs font-bold uppercase tracking-wider mb-3">
            <span className="material-symbols-outlined text-[16px]">domain</span>
            Cổng Đối Tác Doanh Nghiệp
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {user?.agencyProfile?.companyName || user?.fullName || 'Đại lý lữ hành'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Quản lý danh sách tour, dịch vụ lưu trú, vé di chuyển và theo dõi doanh thu trên nền tảng Tripri.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/agency/tours/new"
            className="inline-flex items-center gap-2 bg-primary-container hover:bg-primary text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary-container/20 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Đăng tour mới</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Tổng sản phẩm tour</div>
          <div className="text-2xl font-bold text-slate-900">0</div>
          <div className="text-[11px] text-teal-600 mt-1">Sẵn sàng mở bán</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Đơn đặt tháng này</div>
          <div className="text-2xl font-bold text-slate-900">0</div>
          <div className="text-[11px] text-slate-400 mt-1">Chưa có giao dịch</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Doanh số (VNĐ)</div>
          <div className="text-2xl font-bold text-slate-900">0 ₫</div>
          <div className="text-[11px] text-slate-400 mt-1">Đối soát định kỳ</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">Trạng thái xác minh</div>
          <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full mt-1">
            <span className="material-symbols-outlined text-sm">pending</span>
            {user?.agencyProfile?.verificationStatus || 'Chờ duyệt'}
          </div>
        </div>
      </div>

      {/* Tour List Section */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">Danh sách tour đang vận hành</h2>
        </div>

        <EmptyState
          title="Chưa có tour nào được tạo"
          description="Bắt đầu đăng tải các hành trình du lịch độc bản của bạn để tiếp cận hàng triệu du khách trên Tripri."
          actionLabel="Đăng tour đầu tiên"
          onAction={() => window.location.assign('/agency/tours/new')}
        />
      </div>
    </div>
  );
}
