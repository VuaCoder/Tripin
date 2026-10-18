'use client';

import type { ReactNode } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectAuthStatus, selectUser } from '@/features/auth/store/authSlice';
import { ErrorState, LoadingState } from '@/components/shared';
import { Button } from '@/components/ui';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';

export const control = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 disabled:opacity-60';
export const panel = 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_-5px_rgba(15,23,42,0.12)] sm:p-6';
export const toolbar = `${panel} grid items-end gap-4`;
export const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export const timestamp = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
export const forbidden = (error: unknown) => (error as { status?: number })?.status === 403;

const messages: Record<string, string> = {
  CATEGORY_EXISTS: 'Tên danh mục tạo slug đã tồn tại. Hãy chọn tên khác.',
  PROMOTION_CODE_EXISTS: 'Mã khuyến mãi đã tồn tại.',
  PROMOTION_IN_USE: 'Khuyến mãi đã được sử dụng; không thể thay đổi mức giảm.',
  LAST_SUPER_ADMIN: 'Không thể hạ quyền Super Admin hoạt động cuối cùng.',
};
export function adminError(error: unknown) {
  if (forbidden(error)) return 'Bạn không còn quyền quản trị. Hãy đăng nhập lại để cập nhật quyền.';
  const status = (error as { status?: number | string })?.status;
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR' || status === 'PARSING_ERROR') {
    return 'Chưa xác nhận được kết quả từ máy chủ. Hãy tải lại dữ liệu trước khi thử lưu lại.';
  }
  return messages[getApiErrorCode(error) ?? ''] ?? getApiErrorMessage(error, 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.');
}
export function useAdminSession() {
  const user = useAppSelector(selectUser);
  const status = useAppSelector(selectAuthStatus);
  return { user, ready: status === 'authenticated' && user?.role === 'SUPER_ADMIN' };
}
export function AdminFrame({ title, description, error, loading, refreshing, onRefresh, filters, children }: {
  title: string; description: string; error?: unknown; loading?: boolean; refreshing?: boolean; onRefresh?: () => void; filters?: ReactNode; children: ReactNode;
}) {
  return <div className="mx-auto w-full min-w-0 max-w-[1480px] space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
      <div className="min-w-0"><p className="mb-3 flex items-center gap-1.5 text-xs text-slate-400">Workspace <ChevronRight size={12} /> <span className="text-teal-700">Quản trị</span></p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p></div>
      {onRefresh && <Button variant="outline" disabled={(loading && !error) || refreshing} onClick={onRefresh}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />Tải lại dữ liệu</Button>}
    </header>
    {!forbidden(error) && filters}
    {!!error && <ErrorState title={forbidden(error) ? 'Không có quyền truy cập' : 'Không thể tải dữ liệu quản trị'} message={adminError(error)} onAction={forbidden(error) ? undefined : onRefresh} />}
    {!forbidden(error) && (loading ? !error && <LoadingState label="Đang tải dữ liệu quản trị..." /> : <>
      {!!error && <p role="alert" className="text-sm text-amber-800">Dữ liệu bên dưới là lần tải trước. Kết quả tải lại chưa được xác nhận; thao tác đã được backend xác nhận lưu vẫn được giữ.</p>}
      {refreshing && <p role="status" className="text-sm text-slate-500">Đang cập nhật dữ liệu...</p>}{children}</>)}
  </div>;
}
export function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  return <>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{success}</p>}</>;
}
