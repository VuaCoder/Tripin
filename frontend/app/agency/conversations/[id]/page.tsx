import { Suspense } from 'react';
import { AgencyConversationPage } from '@/features/chat/ConversationPage';

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Đang tải hộp thư...</div>}>
      <AgencyConversationPage id={params.id} />
    </Suspense>
  );
}
