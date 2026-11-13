'use client';

import type { ReactNode } from 'react';
import { message } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectAuthStatus, selectUser } from '@/features/auth/store/authSlice';
import { ErrorState } from '@/components/shared';
import { Button } from '@/components/ui';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import { AdminFallbackSkeleton } from './AdminSkeletons';

export const control = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 disabled:opacity-60';
export const panel = 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_-5px_rgba(15,23,42,0.12)] sm:p-6';
export const toolbar = `${panel} grid items-end gap-4`;
export const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export const timestamp = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa cập nhật';
export const forbidden = (error: unknown) => (error as { status?: number })?.status === 403;

const messages: Record<string, string> = {
  SETTINGS_CONFLICT: 'Dữ liệu đã được quản trị viên khác thay đổi. Hãy nạp lại trước khi lưu.',
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
export function AdminFrame({ title, actions, error, loading, loadingSkeleton, refreshing, onRefresh, filters, children }: {
  title: string; description?: string; actions?: ReactNode; error?: unknown; loading?: boolean; loadingSkeleton?: ReactNode; refreshing?: boolean; onRefresh?: () => unknown | Promise<unknown>; filters?: ReactNode; children: ReactNode;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const refresh = async () => {
    if (!onRefresh) return;
    try {
      const result = await onRefresh();
      const results = Array.isArray(result) ? result : [result];
      const failed = results.some((item) => item && typeof item === 'object' && 'error' in item && Boolean(item.error));
      if (!failed) messageApi.success('Đã cập nhật thành công!');
    } catch {
      // The page query renders the shared error state when the refresh fails.
    }
  };
  return <div className="mx-auto w-full min-w-0 max-w-[1480px] space-y-6 pb-10">
    {contextHolder}
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            disabled={(loading && !error) || refreshing}
            onClick={() => void refresh()}
            aria-label="Làm mới"
            title="Làm mới"
            className="flex items-center justify-center !p-2.5 rounded-xl border-slate-200 hover:bg-slate-100"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin text-teal-600' : 'text-slate-600'} />
            <span className="sr-only">Làm mới</span>
          </Button>
        )}
      </div>
    </header>
    {!forbidden(error) && filters}
    {!!error && <ErrorState title={forbidden(error) ? 'Không có quyền truy cập' : 'Không thể tải dữ liệu quản trị'} message={adminError(error)} onAction={forbidden(error) ? undefined : onRefresh} />}
    {!forbidden(error) && (loading ? !error && <div aria-busy="true" className="min-w-0">{loadingSkeleton ?? <AdminFallbackSkeleton />}</div> : <>
      {!!error && <p role="alert" className="text-sm text-amber-800">Dữ liệu bên dưới là lần tải trước. Kết quả tải lại chưa được xác nhận; thao tác đã được backend xác nhận lưu vẫn được giữ.</p>}
      {children}</>)}
  </div>;
}
export function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  return <>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{success}</p>}</>;
}
