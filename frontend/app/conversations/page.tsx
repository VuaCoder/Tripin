import { Suspense } from 'react';
import { ConversationPage } from '@/features/chat/ConversationPage';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Đang tải hộp thư...</div>}>
      <ConversationPage />
    </Suspense>
  );
}
