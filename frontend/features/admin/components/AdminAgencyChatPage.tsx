'use client';

import { ConversationPage } from '@/features/chat/ConversationPage';

/**
 * Super-admin inbox: lands directly in the shared chat workspace with the most
 * recent conversation opened and the conversation list on the left, instead of
 * a separate agency picker page.
 */
export function AdminAgencyChatPage() {
  return <ConversationPage autoOpenNewest />;
}
