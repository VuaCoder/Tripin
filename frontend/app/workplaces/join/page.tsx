import { redirect } from 'next/navigation';
import { safeNextPath } from '@/features/auth/utils/safeNextPath';

export default function Page({ searchParams }: { searchParams?: { next?: string } }) {
  const next = safeNextPath(searchParams?.next ?? null);
  redirect('/workplaces?join=1' + (next ? '&next=' + encodeURIComponent(next) : ''));
}
