import type { PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import { buildPage, type Page } from '../../utils/pagination';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { usersService, type UsersService } from '../users';
import { sideOf, toConversationDto, toMessageDto } from './chat.mapper';
import type { ConversationDocument } from './chat.model';
import { assignSides, otherSide } from './chat.policy';
import { chatRepository, type ChatRepository } from './chat.repository';
import type {
  ChatPublisher,
  ChatSide,
  ConversationDto,
  ListMessagesQuery,
  MessageDto,
  MessagesPageDto,
  StartConversationInput,
} from './chat.types';

type Actor = { userId: string; role: PersistedRole };

/** All chat rules. Controllers and the socket gateway only translate transport details into calls to this class. */
export class ChatService {
  private publisher?: ChatPublisher;

  constructor(
    private readonly chat: Pick<
      ChatRepository,
      | 'findConversation' | 'findByPair' | 'createConversation' | 'listConversations' | 'recordMessage'
      | 'resetUnread' | 'createMessage' | 'listMessages' | 'markMessagesRead'
    > = chatRepository,
    private readonly users: Pick<UsersService, 'assertActiveWithRole' | 'getSummaries'> = usersService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  /** Registered by the Socket.IO gateway to push messages to connected clients. */
  setPublisher(publisher: ChatPublisher | undefined): void {
    this.publisher = publisher;
  }

  // =========================================================== Conversations

  /**
   * Use case "Make a conversation". Finds or creates the single conversation between this traveler and this guide.
   * The counterpart must be an ACTIVE user of the opposite role (policy in `chat.policy.ts`).
   */
  async startConversation(actor: Actor, input: StartConversationInput): Promise<ConversationDto> {
    const wanted = actor.role === 'TRAVELER' ? 'TOUR_GUIDE' : actor.role === 'TOUR_GUIDE' ? 'TRAVELER' : undefined;
    if (!wanted) throw AppError.forbidden('Conversations are only possible between a traveler and a tour guide');
    const other = await this.users.assertActiveWithRole(input.participantId, wanted);

    const { travelerId, guideId } = assignSides({ id: actor.userId, role: actor.role }, { id: other.id, role: wanted });
    let conversation = await this.chat.findByPair(travelerId, guideId);
    if (!conversation) {
      try {
        conversation = await this.chat.createConversation({
          travelerId: travelerId as never,
          guideId: guideId as never,
          ...(input.tourId ? { tourId: input.tourId as never } : {}),
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        conversation = await this.chat.findByPair(travelerId, guideId); // created concurrently by the other party
        if (!conversation) throw error;
      }
    }
    return this.toDto(conversation, actor.userId);
  }

  async listConversations(actor: Actor, page: { page: number; limit: number }): Promise<Page<ConversationDto>> {
    const side = this.sideForRole(actor.role);
    const { items, total } = await this.chat.listConversations(side, actor.userId, page);
    const counterpartIds = items.map((c) => String(side === 'traveler' ? c.guideId : c.travelerId));
    const people = await this.users.getSummaries(counterpartIds);
    const dtos = items.map((c) => toConversationDto(c, side, people.get(String(side === 'traveler' ? c.guideId : c.travelerId))));
    return buildPage(dtos, total, page);
  }

  // ================================================================ Messages

  async listMessages(userId: string, conversationId: string, query: ListMessagesQuery): Promise<MessagesPageDto> {
    await this.requireParticipation(userId, conversationId);
    const { items, hasMore } = await this.chat.listMessages(conversationId, query.limit, query.before);
    return { items: items.map((message) => toMessageDto(message, userId)), hasMore };
  }

  /**
   * Persists a message from a participant, updates the inbox/unread state, pushes it to both participants' live
   * connections and (only when the recipient had nothing unread) leaves an in-app notification.
   */
  async sendMessage(userId: string, conversationId: string, text: string): Promise<MessageDto> {
    const { conversation, side } = await this.requireParticipation(userId, conversationId);
    const clean = text.trim();
    if (!clean) throw AppError.badRequest('Message cannot be empty');

    const message = await this.chat.createMessage({ conversationId, senderId: userId, text: clean });
    const recipient = otherSide(side);
    const recipientId = String(recipient === 'traveler' ? conversation.travelerId : conversation.guideId);
    const before = await this.chat.recordMessage(conversationId, recipient, {
      text: clean.slice(0, 200),
      senderId: userId,
      sentAt: (message as unknown as { createdAt: Date }).createdAt,
    });

    this.publish(recipientId, conversationId, toMessageDto(message, recipientId));
    this.publish(userId, conversationId, toMessageDto(message, userId));

    const previousUnread = recipient === 'traveler' ? before?.unreadTraveler : before?.unreadGuide;
    if (!previousUnread) {
      await this.notifications.notify(recipientId, {
        type: NOTIFICATION_TYPE.CHAT_MESSAGE,
        title: 'New message',
        body: clean.length > 80 ? `${clean.slice(0, 77)}...` : clean,
        data: { conversationId },
      });
    }
    return toMessageDto(message, userId);
  }

  /** Marks everything the other person sent as read and clears my unread counter. */
  async markRead(userId: string, conversationId: string): Promise<{ unreadCount: number }> {
    const { side } = await this.requireParticipation(userId, conversationId);
    await Promise.all([this.chat.markMessagesRead(conversationId, userId), this.chat.resetUnread(conversationId, side)]);
    return { unreadCount: 0 };
  }

  /** For the gateway: the other participant's id, only if `userId` takes part in the conversation. */
  async getCounterpartId(userId: string, conversationId: string): Promise<string> {
    const { conversation, side } = await this.requireParticipation(userId, conversationId);
    return String(side === 'traveler' ? conversation.guideId : conversation.travelerId);
  }

  // =============================================================== helpers

  /** 404 (never 403) for unknown conversations and for conversations the user is not part of. */
  private async requireParticipation(userId: string, conversationId: string): Promise<{ conversation: ConversationDocument; side: ChatSide }> {
    const conversation = await this.chat.findConversation(conversationId);
    const side = conversation ? sideOf(conversation, userId) : null;
    if (!conversation || !side) throw AppError.notFound('Conversation not found');
    return { conversation, side };
  }

  private sideForRole(role: PersistedRole): ChatSide {
    if (role === 'TRAVELER') return 'traveler';
    if (role === 'TOUR_GUIDE') return 'guide';
    throw AppError.forbidden('Conversations are only possible between a traveler and a tour guide');
  }

  private async toDto(conversation: ConversationDocument, userId: string): Promise<ConversationDto> {
    const side = sideOf(conversation, userId)!;
    const counterpartId = String(side === 'traveler' ? conversation.guideId : conversation.travelerId);
    const people = await this.users.getSummaries([counterpartId]);
    return toConversationDto(conversation, side, people.get(counterpartId));
  }

  private publish(userId: string, conversationId: string, message: MessageDto): void {
    try {
      this.publisher?.(userId, { conversationId, message });
    } catch (error) {
      logger.warn('Chat publisher failed', { message: (error as Error).message });
    }
  }
}

export const chatService = new ChatService();
