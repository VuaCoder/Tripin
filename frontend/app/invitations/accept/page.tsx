import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AcceptInvitationPage } from '@/features/agency-invitation/AcceptInvitationPage';

export const metadata: Metadata = {
  title: 'Chấp nhận lời mời | Tripri',
  description: 'Chấp nhận lời mời tham gia doanh nghiệp trên Tripri.',
};

export default function AcceptInvitationRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-desk-travel px-4 text-slate-500">
          Đang tải…
        </div>
      }
    >
      <AcceptInvitationPage />
    </Suspense>
  );
}
