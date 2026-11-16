import { AdminAgencyChatPage } from '@/features/admin';

export const dynamic = 'force-dynamic';

export default function AgencyChatThreadPage({ params }: { params: { id: string } }) {
  return <AdminAgencyChatPage id={params.id} />;
}
