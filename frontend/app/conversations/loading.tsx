import { ConversationListSkeleton, ThreadSkeleton } from '@/features/chat/components/ChatSkeleton';

export default function ConversationsLoading() {
  return (
    <div className="flex h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-white">
      <div className="w-full max-w-sm border-r border-slate-200">
        <ConversationListSkeleton />
      </div>
      <div className="hidden flex-1 md:block">
        <ThreadSkeleton />
      </div>
    </div>
  );
}

