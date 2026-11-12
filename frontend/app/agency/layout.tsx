'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { selectUser } from '@/features/auth';
import { selectActiveAgency } from '@/features/auth/store/authSlice';
import { useAgencyMembershipsQuery } from '@/features/agency/agencyContext';
import { AgencySelector } from '@/features/agency/components/AgencySelector';
import { agencyRoutePermission } from '@/features/agency/agencyRoutePermission';
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

  const isAuthRoute =
    ['/agency/login', '/agency/register', '/agency/verify-otp'].includes(pathname) ||
    pathname.startsWith('/agency/application');

  const memberships = useAgencyMembershipsQuery(undefined, {
    skip: isAuthRoute || status !== 'authenticated', pollingInterval: 30000,
    skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true, refetchOnMountOrArgChange: true,
  });
  useEffect(() => {
    if (!isAuthRoute && status === 'unauthenticated') router.replace('/agency/login');
  }, [isAuthRoute, status, router]);

  if (isAuthRoute) return <>{children}</>;
  if (status !== 'authenticated') return <p role="status" className="p-6">Đang kiểm tra phiên đăng nhập…</p>;
  if (!membershipsReady) return <div className="p-6">{memberships.isError
    ? <><p role="alert">Không thể xác minh quyền doanh nghiệp. Vui lòng thử lại.</p><button type="button" className="mt-3 underline" onClick={() => void memberships.refetch()}>Thử lại</button></>
    : <p role="status">Đang xác minh doanh nghiệp của bạn…</p>}</div>;
  if (!agencies.length) return <main className="space-y-4 p-6"><h1 className="text-2xl font-bold">Chưa có quyền truy cập doanh nghiệp</h1><p role="alert">Bạn không có membership đang hoạt động. Tài khoản cá nhân vẫn sử dụng bình thường.</p><Link href="/">Về trang cá nhân</Link><button type="button" className="block underline" onClick={() => void memberships.refetch()}>Kiểm tra lại quyền truy cập</button></main>;
  if (!activeAgency) return <main className="mx-auto max-w-2xl space-y-6 p-6"><h1 className="text-2xl font-bold">Chọn doanh nghiệp</h1><p>Chọn doanh nghiệp bạn muốn làm việc. Dữ liệu và quyền sẽ được tách riêng.</p><AgencySelector /></main>;
  if (activeAgency.verificationStatus !== 'VERIFIED') return <main className="space-y-4 p-6"><AgencySelector /><h1 className="text-2xl font-bold">Doanh nghiệp chưa được xác minh</h1><p role="status">Trạng thái: {activeAgency.verificationStatus}. Các chức năng vận hành chưa được mở.</p>{user?.role === 'AGENCY' && activeAgency.agencyId === user.id && <Link href={`/application-status?email=${encodeURIComponent(user.email)}`}>Xem trạng thái hồ sơ</Link>}</main>;
  const permission = agencyRoutePermission(pathname);
  const allowed = !permission || activeAgency.permissions.includes(permission);

  return (
      <div className={`${sidebarStyles.shell} bg-[#f7f8f5]`}>
        <AgencyNav />
        <div className={sidebarStyles.body}><div className="px-4 pt-4 sm:px-6"><AgencySelector /></div><AntdRegistry><div key={activeAgency.agencyId}>{allowed ? children : <p role="alert" className="p-6">Bạn không có quyền truy cập chức năng này trong doanh nghiệp đang chọn.</p>}</div></AntdRegistry></div>
      </div>
  );
}
