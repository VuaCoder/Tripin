export interface AiChatMessage {
  incomplete?: boolean;
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status?: 'sending' | 'sent' | 'seen' | 'error';
  error?: string;
}

export interface AiConversationSummary {
  lastMessage: AiChatMessage | null;
  unreadCount: number;
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

export interface AiConversationDetail extends AiConversationSummary {
  messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  }[];
}

export interface AiChatResult {
  conversationId: string;
  reply: {
    id: string;
    incomplete?: boolean;
    role: 'assistant';
    content: string;
    createdAt: string;
  };
  messageCount: number;
}

export interface AiChatInput {
  conversationId?: string;
  message: string;
}

export interface AiApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
