'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { CompletionReportPage } from '@/features/moderation/components/CompletionReportPage';
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  return <CompletionReportPage id={id} byBooking={params?.get('byBooking') === 'true'} />;
}
