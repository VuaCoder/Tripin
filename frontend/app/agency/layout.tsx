'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { selectUser } from '@/features/auth';
import { selectActiveAgency } from '@/features/auth/store/authSlice';
import { useAgencyMembershipsQuery } from '@/features/agency/agencyContext';
import { agencyRoutePermission } from '@/features/agency/agencyRoutePermission';
import { workplaceHome } from '@/features/agency/workplaceHome';
import { useAppSelector } from '@/store/hooks';
import { AgencyNav } from '@/features/agency/components/AgencyNav';
import sidebarStyles from '@/features/agency/components/AgencySidebar.module.css';
import { AntdRegistry } from '@ant-design/nextjs-registry';

export default function AgencyLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const status = useAppSelector(state => state.auth.status);
  const membershipsReady = useAppSelector(state => state.auth.membershipsReady);
  const activeAgency = useAppSelector(selectActiveAgency);
  const agencies = useAppSelector(state => state.auth.agencies);
  const landingRoute = activeAgency ? workplaceHome(activeAgency) : null;

  const isAuthRoute =
    ['/agency/login', '/agency/register', '/agency/verify-otp'].includes(pathname) ||
    pathname.startsWith('/agency/application') || pathname === '/agency/invitations/accept';

  const memberships = useAgencyMembershipsQuery(undefined, {
    skip: isAuthRoute || status !== 'authenticated', pollingInterval: 30000,
    skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true, refetchOnMountOrArgChange: true,
  });
  useEffect(() => {
    if (!isAuthRoute && (status === 'unauthenticated' || (!user && status !== 'idle'))) router.replace('/agency/login');
    if (!isAuthRoute && status === 'authenticated' && membershipsReady && (!agencies.length || !activeAgency)) {
      router.replace('/workplaces?next=' + encodeURIComponent(pathname));
    }
  }, [isAuthRoute, status, user, membershipsReady, agencies.length, activeAgency, pathname, router]);
  useEffect(() => {
    if (pathname === '/agency' && membershipsReady && activeAgency?.verificationStatus === 'VERIFIED' && landingRoute && landingRoute !== '/agency') {
      router.replace(landingRoute);
    }
  }, [pathname, membershipsReady, activeAgency, landingRoute, router]);

  if (isAuthRoute) return <>{children}</>;
  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5]">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 shadow-sm border border-slate-200/80">
          <span className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" aria-hidden="true" />
          <p role="status" className="text-sm font-semibold text-slate-700">Đang kiểm tra phiên đăng nhập…</p>
        </div>
      </div>
    );
  }
  if (!membershipsReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5]">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 shadow-sm border border-slate-200/80">
          {memberships.isError ? (
            <div role="alert" className="text-center space-y-3">
              <p className="text-sm font-semibold text-rose-600">Không thể xác minh quyền doanh nghiệp. Vui lòng thử lại.</p>
              <button type="button" className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition" onClick={() => void memberships.refetch()}>Thử lại</button>
            </div>
          ) : (
            <>
              <span className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" aria-hidden="true" />
              <p role="status" className="text-sm font-semibold text-slate-700">Đang xác minh doanh nghiệp của bạn…</p>
            </>
          )}
        </div>
      </div>
    );
  }
  if (!agencies.length) return <main className="space-y-4 p-6"><h1 className="text-2xl font-bold">Chưa có quyền truy cập doanh nghiệp</h1><p>Bạn có thể tạo doanh nghiệp hoặc nhập mã để gửi yêu cầu tham gia.</p><Link className="block text-teal-800 underline" href="/workplaces">Mở Nơi làm việc</Link><Link className="block underline" href="/">Về trang cá nhân</Link><button type="button" className="block underline" onClick={() => void memberships.refetch()}>Kiểm tra lại quyền truy cập</button></main>;
  if (!activeAgency) return <main className="mx-auto max-w-2xl space-y-6 p-6"><h1 className="text-2xl font-bold">Chọn doanh nghiệp</h1><p>Chọn doanh nghiệp bạn muốn làm việc. Dữ liệu và quyền sẽ được tách riêng.</p><Link className="text-teal-800 underline" href="/workplaces">Mở trang chọn doanh nghiệp</Link></main>;
  if (activeAgency.verificationStatus !== 'VERIFIED' && !pathname.startsWith('/agency/team')) return <main className="space-y-4 p-6"><h1 className="text-2xl font-bold">Doanh nghiệp chưa được xác minh</h1><p role="status">Trạng thái: {activeAgency.verificationStatus}. Các chức năng vận hành chưa được mở.</p>{activeAgency.memberRole === 'OWNER' && <><Link className="block underline" href="/agency/application/workplace">Hoàn thiện và xem trạng thái hồ sơ</Link><Link className="block underline" href="/agency/team">Quản lý thành viên</Link></>}<Link className="block underline" href="/workplaces">Chuyển doanh nghiệp</Link></main>;
  if (pathname === '/agency' && landingRoute && landingRoute !== '/agency') return <p role="status" className="p-6">Đang mở trang làm việc…</p>;
  const permission = agencyRoutePermission(pathname);
  const allowed = (!permission || activeAgency.permissions.includes(permission)) &&
    !(pathname.startsWith('/agency/settings/commission') && activeAgency.memberRole === 'STAFF');

  return (
      <div className={`${sidebarStyles.shell} bg-[#f7f8f5]`}>
        <AgencyNav />
        <div className={sidebarStyles.body}><AntdRegistry><div key={activeAgency.agencyId}>{allowed ? children : <p role="alert" className="p-6">Bạn không có quyền truy cập chức năng này trong doanh nghiệp đang chọn.</p>}</div></AntdRegistry></div>
      </div>
  );
}
