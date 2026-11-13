'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';
import { AdminSidebar } from '@/features/admin';
import sidebarStyles from '@/features/agency/components/AgencySidebar.module.css';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AdminAccessSkeleton } from '@/features/admin/components/AdminSkeletons';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN']} loadingFallback={<AdminAccessSkeleton />}>
      <div className={`${sidebarStyles.shell} bg-[#f7f8f5] min-h-screen`}>
        <AdminSidebar />
        <div className={`${sidebarStyles.body} w-full`}>
          <AntdRegistry>
            <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {children}
            </div>
          </AntdRegistry>
        </div>
      </div>
    </RoleGuard>
  );
}
