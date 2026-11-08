'use client';

import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth';
import { ModeratorSidebar } from '@/features/moderation';
import sidebarStyles from '@/features/agency/components/AgencySidebar.module.css';
import { AntdRegistry } from '@ant-design/nextjs-registry';

export default function ModeratorLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['MODERATOR', 'SUPER_ADMIN']}>
      <div className={`${sidebarStyles.shell} bg-[#f7f8f5] min-h-screen`}>
        <ModeratorSidebar />
        <div className={`${sidebarStyles.body} w-full`}>
          <AntdRegistry>
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {children}
            </div>
          </AntdRegistry>
        </div>
      </div>
    </RoleGuard>
  );
}
