'use client';

import { ConversationPage } from '@/features/chat/ConversationPage';

/**
 * Super-admin inbox: lands directly in the shared chat workspace with the most
 * recent conversation opened and the conversation list on the left, instead of
 * a separate agency picker page.
 *
 * The base path stays inside /super-admin/agency-chat so opening a thread does
 * not leave the admin shell (the AdminSidebar "Nhắn tin" highlight is kept).
 */
export function AdminAgencyChatPage({ id }: { id?: string }) {
  return <ConversationPage id={id} autoOpenNewest={!id} basePath="/super-admin/agency-chat" />;
}
