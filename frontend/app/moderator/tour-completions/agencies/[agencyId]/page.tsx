'use client';
import { useParams } from 'next/navigation';
import { CompletionAgencyReportsPage } from '@/features/moderation/components/CompletionReportsPage';

export default function Page() {
  const { agencyId } = useParams<{ agencyId: string }>();
  return <CompletionAgencyReportsPage agencyId={agencyId} />;
}
