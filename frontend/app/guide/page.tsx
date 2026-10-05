'use client';

import React from 'react';
import { selectUser, useLogout } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';

const UPCOMING_FEATURES = [
  { icon: 'map', label: 'Quản lý tour và lịch trình nhận khách' },
  { icon: 'calendar_month', label: 'Theo dõi lịch đặt tour của du khách' },
  { icon: 'payments', label: 'Thống kê thu nhập và đánh giá' },
];

export default function GuideDashboardPage() {
  const user = useAppSelector(selectUser);
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-desk-travel flex flex-col items-center justify-center px-4 sm:px-6 py-10 selection:bg-brand-teal selection:text-white">
      <main className="w-full max-w-2xl animate-fadeInScale">
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl p-6 sm:p-9">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <span className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-100 text-brand-teal text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full">
                <span className="material-symbols-outlined text-sm leading-none">explore</span>
                Hướng dẫn viên
              </span>
              <h1 className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
                Bảng điều khiển Hướng dẫn viên
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Xin chào {user?.fullName || 'Hướng dẫn viên'}, chúc bạn một ngày dẫn tour thật vui!
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="self-start sm:self-auto py-2.5 px-5 rounded-full border border-slate-200 hover:border-brand-teal text-slate-700 hover:text-brand-teal bg-white font-semibold text-xs transition-all duration-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base leading-none">logout</span>
              Đăng xuất
            </button>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-900">Tính năng sắp ra mắt</h2>
            <p className="text-xs text-slate-500 mt-1">
              Khu vực quản lý dành cho Hướng dẫn viên đang được hoàn thiện. Vui lòng quay lại sau.
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {UPCOMING_FEATURES.map((feature) => (
                <li key={feature.icon} className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
                  <span className="material-symbols-outlined text-base text-brand-tealLight leading-none">
                    {feature.icon}
                  </span>
                  {feature.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
