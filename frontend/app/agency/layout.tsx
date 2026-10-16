'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RoleGuard, selectUser } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { AgencyNav } from '@/features/agency/AgencyUi';
import sidebarStyles from '@/features/agency/components/AgencySidebar.module.css';
import { AntdRegistry } from '@ant-design/nextjs-registry';

export default function AgencyLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppSelector(selectUser);

  const isAuthRoute =
    ['/agency/login', '/agency/register', '/agency/verify-otp'].includes(pathname) ||
    pathname.startsWith('/agency/application');

  useEffect(() => {
    if (isAuthRoute) return;
    if (user && user.role === 'AGENCY') {
      const verification = user.agencyProfile?.verificationStatus;
      if (verification && verification !== 'VERIFIED') {
        router.replace(`/application-status?email=${encodeURIComponent(user.email)}`);
      }
    }
  }, [user, isAuthRoute, router]);

  if (isAuthRoute) return <>{children}</>;
  if (user?.role === 'AGENCY' && user.agencyProfile?.verificationStatus && user.agencyProfile.verificationStatus !== 'VERIFIED') return <p role="status">Đang mở trạng thái hồ sơ…</p>;

  return (
    <RoleGuard allowedRoles={['AGENCY']} loginPath="/agency/login">
      <div className={`${sidebarStyles.shell} bg-[#f7f8f5]`}>
        <AgencyNav />
        <div className={sidebarStyles.body}><AntdRegistry>{children}</AntdRegistry></div>
      </div>
    </RoleGuard>
  );
}
