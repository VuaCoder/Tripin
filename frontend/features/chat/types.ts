export interface Conversation {
  id: string;
  counterpart: { id: string; fullName: string; avatarUrl?: string; role: string } | null;
  tourId?: string;
  lastMessage?: { text: string; senderId: string; sentAt: string };
  unreadCount: number;
  updatedAt: string;
}
export interface Message {
  id: string; conversationId: string; senderId: string; text: string;
  isMine: boolean; createdAt: string; readAt?: string;
}
export interface MessagesPage { items: Message[]; hasMore: boolean }
export type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
export function mergeMessages(previous: Message[], incoming: Message[]): Message[] {
  const byId = new Map(previous.map(message => [message.id, message]));
  incoming.forEach(message => byId.set(message.id, { ...byId.get(message.id), ...message }));
  return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
