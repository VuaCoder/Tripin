import { redirect } from 'next/navigation';
import { safeNextPath } from '@/features/auth/utils/safeNextPath';

export const metadata = { title: 'Chọn nơi làm việc | Tripri Partner' };

export default function Page({ searchParams }: { searchParams?: { next?: string } }) {
  const next = safeNextPath(searchParams?.next ?? null);
  redirect('/workplaces' + (next ? '?next=' + encodeURIComponent(next) : ''));
}
