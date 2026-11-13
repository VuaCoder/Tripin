'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { selectUser } from '@/features/auth';
import { selectActiveAgency } from '@/features/auth/store/authSlice';
import { useAgencyMembershipsQuery } from '@/features/agency/agencyContext';
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
    pathname.startsWith('/agency/application') || pathname === '/agency/invitations/accept';

  const memberships = useAgencyMembershipsQuery(undefined, {
    skip: isAuthRoute || status !== 'authenticated', pollingInterval: 30000,
    skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true, refetchOnMountOrArgChange: true,
  });
  useEffect(() => {
    if (!isAuthRoute && status === 'unauthenticated') router.replace('/agency/login');
    if (!isAuthRoute && status === 'authenticated' && membershipsReady && (!agencies.length || !activeAgency)) {
      router.replace('/workplaces?next=' + encodeURIComponent(pathname));
    }
  }, [isAuthRoute, status, membershipsReady, agencies.length, activeAgency, pathname, router]);

  if (isAuthRoute) return <>{children}</>;
  if (status !== 'authenticated') return <p role="status" className="p-6">Đang kiểm tra phiên đăng nhập…</p>;
  if (!membershipsReady) return <div className="p-6">{memberships.isError
    ? <><p role="alert">Không thể xác minh quyền doanh nghiệp. Vui lòng thử lại.</p><button type="button" className="mt-3 underline" onClick={() => void memberships.refetch()}>Thử lại</button></>
    : <p role="status">Đang xác minh doanh nghiệp của bạn…</p>}</div>;
  if (!agencies.length) return <main className="space-y-4 p-6"><h1 className="text-2xl font-bold">Chưa có quyền truy cập doanh nghiệp</h1><p>Bạn có thể tạo doanh nghiệp hoặc nhập mã để gửi yêu cầu tham gia.</p><Link className="block text-teal-800 underline" href="/workplaces">Mở Nơi làm việc</Link><Link className="block underline" href="/">Về trang cá nhân</Link><button type="button" className="block underline" onClick={() => void memberships.refetch()}>Kiểm tra lại quyền truy cập</button></main>;
  if (!activeAgency) return <main className="mx-auto max-w-2xl space-y-6 p-6"><h1 className="text-2xl font-bold">Chọn doanh nghiệp</h1><p>Chọn doanh nghiệp bạn muốn làm việc. Dữ liệu và quyền sẽ được tách riêng.</p><Link className="text-teal-800 underline" href="/workplaces">Mở trang chọn doanh nghiệp</Link></main>;
  if (activeAgency.verificationStatus !== 'VERIFIED' && !pathname.startsWith('/agency/team')) return <main className="space-y-4 p-6"><h1 className="text-2xl font-bold">Doanh nghiệp chưa được xác minh</h1><p role="status">Trạng thái: {activeAgency.verificationStatus}. Các chức năng vận hành chưa được mở.</p>{activeAgency.memberRole === 'OWNER' && <><Link className="block underline" href="/agency/application/workplace">Hoàn thiện và xem trạng thái hồ sơ</Link><Link className="block underline" href="/agency/team">Quản lý thành viên</Link></>}<Link className="block underline" href="/workplaces">Chuyển doanh nghiệp</Link></main>;
  const permission = agencyRoutePermission(pathname);
  const allowed = !permission || activeAgency.permissions.includes(permission);

  return (
      <div className={`${sidebarStyles.shell} bg-[#f7f8f5]`}>
        <AgencyNav />
        <div className={sidebarStyles.body}><AntdRegistry><div key={activeAgency.agencyId}>{allowed ? children : <p role="alert" className="p-6">Bạn không có quyền truy cập chức năng này trong doanh nghiệp đang chọn.</p>}</div></AntdRegistry></div>
      </div>
  );
}
