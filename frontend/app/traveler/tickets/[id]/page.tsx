'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { LoadingState } from '@/components/shared';
import { ETicketView } from '@/features/e-ticket';
import { TravelerAccountShell } from '@/features/traveler-account/components';

export default function TravelerTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = typeof params?.id === 'string' ? params.id : '';

  return (
    <TravelerAccountShell>
      <Suspense fallback={<LoadingState label="Đang tải vé điện tử..." />}>
        <ETicketView ticketId={ticketId} />
      </Suspense>
    </TravelerAccountShell>
  );
}
