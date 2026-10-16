'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';

export const agencyInput = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
export const agencyButton = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50';
export const agencyPanel = 'min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6';
export const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
export const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN');
export const bookingStatusNames = { PENDING: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };

export function useAgencyPermission(permission: string) {
  return useAppSelector(selectUser)?.permissions.includes(permission) ?? false;
}

import { AgencyRightSidebar } from './components/AgencyRightSidebar';
export { AgencyRightSidebar } from './components/AgencyRightSidebar';
export { AgencyPartnerSettings } from './components/AgencyPartnerSettings';
export { AgencyProfileSettings } from './components/AgencyProfileSettings';
export { AgencyCommissionSettings } from './components/AgencyCommissionSettings';

export function AgencyNav() {
  return <AgencyRightSidebar />;
}

export function AgencyDenied() {
  return <p role="alert" className="mx-auto max-w-7xl p-6 text-slate-700">Bạn không có quyền truy cập chức năng này.</p>;
}

export function AgencyLoading({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return <div role="status" className="space-y-3 py-6"><p className="text-sm text-slate-600">{label}</p><div aria-hidden="true" className="h-28 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" /></div>;
}

export function AgencyError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{message}</p><button type="button" onClick={retry} className={`${agencyButton} mt-3`}>Thử lại</button></div>;
}
