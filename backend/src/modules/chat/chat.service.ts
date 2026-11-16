import { isUniqueViolation, type Prisma } from '../../config/database';
import { containsProfanity, PROFANITY_ERROR_MESSAGE, type PersistedRole } from '@travel-platform/constants';
import { AppError, ERROR_CODES } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import { buildPage, type Page } from '../../utils/pagination';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { usersService, type UsersService, type UserSummary } from '../users';
import { toConversationDto, toMessageDto } from './chat.mapper';
import type { ConversationRecord, MessageRecord } from './chat.repository';
import { assignSides, otherSide } from './chat.policy';
import { chatRepository, type ChatRepository } from './chat.repository';
import type {
  ChatActor,
  ChatPublisher,
  ChatSide,
  ConversationDto,
  ListMessagesQuery,
  MessageDto,
  MessagesPageDto,
  StartConversationInput,
} from './chat.types';

type Person = {
  id: string;
  role: PersistedRole;
  fullName: string;
  avatarUrl: string | null;
  agencyProfile?: { companyName: string | null } | null;
};

/** All chat rules. Controllers and the socket gateway only translate transport details into calls to this class. */
export class ChatService {
  private readPublisher?: (userId: string, conversationId: string) => void;
  setReadPublisher(publisher: (userId: string, conversationId: string) => void) { this.readPublisher = publisher; }
  private publisher?: ChatPublisher;

  constructor(
    private readonly chat: Pick<
      ChatRepository,
      | 'findConversation'
      | 'findByPair'
      | 'findByAgencyPair'
      | 'createConversation'
      | 'listConversations'
      | 'listAgencyChatUserIds'
      | 'isAgencyChatMember'
      | 'appendMessageAndBumpUnread'
      | 'listMessages'
      | 'markReadWithWatermark'
    > = chatRepository,
    private readonly users: Pick<
      UsersService,
      'assertActiveWithRole' | 'assertActiveWithRoles' | 'assertAgencyVerified' | 'getSummaries'
    > = usersService,
    private readonly notifications: Pick<NotificationsService, 'notify' | 'notifyAgency'> = notificationsService,
  ) {}

  /** Registered by the Socket.IO gateway to push messages to connected clients. */
  setPublisher(publisher: ChatPublisher | undefined): void {
    this.publisher = publisher;
  }

  // =========================================================== Conversations

  /**
   * Use case "Make a conversation". Finds or creates the single thread between a traveler and a guide, or between a
   * traveler and an agency's shared inbox. The counterpart must be an ACTIVE user of the opposite role.
   */
  async startConversation(actor: ChatActor, input: StartConversationInput): Promise<ConversationDto> {
    if (actor.role !== 'TRAVELER' && actor.role !== 'TOUR_GUIDE' && actor.role !== 'AGENCY' && actor.role !== 'SUPER_ADMIN') {
      throw AppError.forbidden('Bạn không có quyền mở cuộc trò chuyện này.');
    }
    if (input.agencyId && input.participantId) {
      throw AppError.badRequest('Provide either participantId or agencyId, not both');
    }
    if (input.agencyId) {
      if (actor.role !== 'TRAVELER') throw AppError.badRequest('Only a traveler can start an agency conversation by agencyId');
      return this.openAgencyThread(actor.userId, actor.userId, input.agencyId, input.tourId);
    }

    if (actor.role === 'AGENCY') {
      if (!actor.agencyId) throw AppError.forbidden('Agency context required');
      if (!input.participantId) throw AppError.badRequest('participantId is required');
      const traveler = await this.users.assertActiveWithRole(input.participantId, 'TRAVELER');
      return this.openAgencyThread(actor.userId, traveler.id, actor.agencyId, input.tourId);
    }
    if (!input.participantId) throw AppError.badRequest('participantId is required');

    let other: Person;
    if (actor.role === 'SUPER_ADMIN') {
      other = await this.users.assertActiveWithRole(input.participantId, 'AGENCY');
    } else if (actor.role === 'TRAVELER') {
      other = await this.users.assertActiveWithRoles(input.participantId, ['AGENCY', 'TOUR_GUIDE']);
    } else {
      // Counterpart of an operator must be checked before 404
      const candidate = await this.users.getSummaries([input.participantId]);
      const summary = candidate.get(input.participantId);
      if (summary && summary.role !== 'TRAVELER') {
        throw AppError.forbidden('Conversations are only possible between a traveler and an agency or tour guide');
      }
      other = await this.users.assertActiveWithRole(input.participantId, 'TRAVELER');
    }

    const { travelerId, guideId } = assignSides({ id: actor.userId, role: actor.role }, { id: other.id, role: other.role });
    let conversation = await this.chat.findByPair(travelerId, guideId);
    if (!conversation) {
      try {
        conversation = await this.chat.createConversation({
          travelerId,
          guideId,
          ...(input.tourId ? { tourId: input.tourId as never } : {}),
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        conversation = await this.chat.findByPair(travelerId, guideId); // created concurrently by the other party
        if (!conversation) throw error;
      }
    }
    const displayName = (other.role === 'AGENCY' && other.agencyProfile?.companyName?.trim())
      ? other.agencyProfile.companyName.trim()
      : other.fullName;
    return this.toDto(conversation, actor.userId, actor.userId === travelerId ? 'traveler' : 'guide', {
      id: other.id,
      fullName: displayName,
      avatarUrl: other.avatarUrl ?? undefined,
      role: other.role,
      companyName: other.agencyProfile?.companyName ?? undefined,
    });
  }

  async listConversations(actor: ChatActor, page: { page: number; limit: number }): Promise<Page<ConversationDto>> {
    let side: ChatSide;
    let where: Prisma.ConversationWhereInput;
    if (actor.agencyId) {
      // The tenant wins over the global role: an agency's owner keeps the personal TRAVELER role.
      side = 'guide';
      where = { agencyId: actor.agencyId };
    } else if (actor.role === 'TRAVELER' || actor.role === 'SUPER_ADMIN') {
      side = 'traveler';
      where = { travelerId: actor.userId };
    } else if (actor.role === 'AGENCY') {
      side = 'guide';
      // A direct /chat visit keeps the old personal threads.
      where = { guideId: actor.userId, agencyId: null };
    } else if (actor.role === 'TOUR_GUIDE') {
      side = 'guide';
      where = { guideId: actor.userId, agencyId: null };
    } else {
      throw AppError.forbidden('Conversations are only possible between a traveler and an agency or tour guide');
    }

    const { items, total } = await this.chat.listConversations(where, page);
    const counterpartId = (conversation: ConversationRecord): string =>
      side === 'traveler' ? String(conversation.agencyId ?? conversation.guideId) : conversation.travelerId;
    const people = await this.users.getSummaries(items.map(counterpartId));
    return buildPage(items.map((conversation) => toConversationDto(conversation, side, people.get(counterpartId(conversation)))), total, page);
  }

  // ================================================================ Messages

  async getConversation(userId: string, conversationId: string, agencyId?: string): Promise<ConversationDto> {
    const { conversation, side } = await this.requireParticipation(userId, conversationId, agencyId);
    return this.toDto(conversation, userId, side);
  }

  async listMessages(userId: string, conversationId: string, query: ListMessagesQuery, agencyId?: string): Promise<MessagesPageDto> {
    await this.requireParticipation(userId, conversationId, agencyId);
    const { items, hasMore } = await this.chat.listMessages(conversationId, query.limit, query.before);
    return { items: items.map((message) => toMessageDto(message, userId)), hasMore };
  }

  /**
   * Persists a message from a participant, updates the inbox/unread state, pushes it to the participants' live
   * connections and (only when the recipient had nothing unread) leaves an in-app notification.
   */
  async sendMessage(userId: string, conversationId: string, text: string, agencyId?: string): Promise<MessageDto> {
    const { conversation, side } = await this.requireParticipation(userId, conversationId, agencyId);
    const clean = text.trim();
    if (!clean) throw AppError.badRequest('Message cannot be empty');
    if (containsProfanity(clean)) {
      throw AppError.badRequest(PROFANITY_ERROR_MESSAGE, undefined, ERROR_CODES.PROFANITY_DETECTED);
    }

    const recipient = otherSide(side);
    const { message, before } = await this.chat.appendMessageAndBumpUnread(
      { conversationId, senderId: userId, text: clean },
      recipient,
    );

    if (recipient === 'traveler') {
      this.publish(conversation.travelerId, conversationId, toMessageDto(message, conversation.travelerId));
    } else if (conversation.agencyId) {
      await this.publishAgency(conversation, message);
    } else {
      const guideId = String(conversation.guideId);
      this.publish(guideId, conversationId, toMessageDto(message, guideId));
    }
    this.publish(userId, conversationId, toMessageDto(message, userId));
    // A colleague's open thread should update too, not only the member who sent it.
    if (conversation.agencyId && side === 'guide') await this.publishAgency(conversation, message, userId);

    const previousUnread = recipient === 'traveler' ? before?.unreadTraveler : before?.unreadGuide;
    if (!previousUnread) {
      const notification = {
        type: NOTIFICATION_TYPE.CHAT_MESSAGE,
        title: 'New message',
        body: clean.length > 80 ? `${clean.slice(0, 77)}...` : clean,
        data: { conversationId },
      };
      if (recipient === 'traveler') await this.notifications.notify(conversation.travelerId, notification);
      else if (conversation.agencyId) await this.notifications.notifyAgency(conversation.agencyId, notification);
      else await this.notifications.notify(String(conversation.guideId), notification);
    }
    return toMessageDto(message, userId);
  }

  /** Marks everything the other side sent as read (watermark) and recomputes my unread counter. */
  async markRead(userId: string, conversationId: string, agencyId?: string): Promise<{ unreadCount: number }> {
    const { conversation, side } = await this.requireParticipation(userId, conversationId, agencyId);
    // The agency side only counts the traveler's messages; a colleague's reply is not unread for the agency.
    const onlySenderId = side === 'guide' && conversation.agencyId ? conversation.travelerId : undefined;
    const result = await this.chat.markReadWithWatermark(conversationId, side, userId, onlySenderId);
    if (conversation.agencyId && side === 'guide') {
      for (const memberId of await this.chat.listAgencyChatUserIds(conversation.agencyId)) this.readPublisher?.(memberId, conversationId);
    } else {
      this.readPublisher?.(userId, conversationId);
    }
    return result;
  }

  /** For the gateway: every socket that should see this user typing. */
  async getTypingRecipientIds(userId: string, conversationId: string, agencyId?: string): Promise<string[]> {
    const { conversation, side } = await this.requireParticipation(userId, conversationId, agencyId);
    if (side === 'traveler') {
      return conversation.agencyId ? this.chat.listAgencyChatUserIds(conversation.agencyId) : [String(conversation.guideId)];
    }
    return [conversation.travelerId];
  }

  /** Kept for callers that only need one recipient (a guide thread or the agency's first member). */
  async getCounterpartId(userId: string, conversationId: string, agencyId?: string): Promise<string | null> {
    return (await this.getTypingRecipientIds(userId, conversationId, agencyId))[0] ?? null;
  }

  // =============================================================== helpers

  /** 404 (never 403) for unknown conversations and for conversations the user is not part of. */
  private async requireParticipation(
    userId: string,
    conversationId: string,
    agencyId?: string,
  ): Promise<{ conversation: ConversationRecord; side: ChatSide }> {
    const conversation = await this.chat.findConversation(conversationId);
    if (!conversation) throw AppError.notFound('Conversation not found');
    if (conversation.travelerId === userId) return { conversation, side: 'traveler' };
    if (conversation.agencyId) {
      // The HTTP tenant route already checked the header; a socket has none, so prove membership here.
      const allowed = agencyId
        ? conversation.agencyId === agencyId
        : await this.chat.isAgencyChatMember(userId, conversation.agencyId);
      if (allowed) return { conversation, side: 'guide' };
      throw AppError.notFound('Conversation not found');
    }
    if (conversation.guideId === userId) return { conversation, side: 'guide' };
    throw AppError.notFound('Conversation not found');
  }

  private async openAgencyThread(actorId: string, travelerId: string, agencyId: string, tourId?: string): Promise<ConversationDto> {
    // The id must be a verified AgencyProfile, not an arbitrary user id (the FK would otherwise fail as a 500).
    try {
      await this.users.assertAgencyVerified(agencyId);
    } catch {
      throw AppError.notFound('Agency not found');
    }
    const agency = (await this.users.getSummaries([agencyId])).get(agencyId);
    if (!agency) throw AppError.notFound('Agency not found');

    let conversation = await this.chat.findByAgencyPair(travelerId, agencyId);
    if (!conversation) {
      try {
        conversation = await this.chat.createConversation({ travelerId, agencyId, ...(tourId ? { tourId } : {}) });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        conversation = await this.chat.findByAgencyPair(travelerId, agencyId);
        if (!conversation) throw error;
      }
    }
    const side: ChatSide = actorId === travelerId ? 'traveler' : 'guide';
    const summary = side === 'traveler'
      ? agency
      : (await this.users.getSummaries([travelerId])).get(travelerId);
    return toConversationDto(conversation, side, summary);
  }

  private async toDto(
    conversation: ConversationRecord,
    userId: string,
    side: ChatSide,
    counterpartSummary?: Partial<UserSummary>,
  ): Promise<ConversationDto> {
    const counterpartId = side === 'traveler'
      ? String(conversation.agencyId ?? conversation.guideId)
      : conversation.travelerId;
    const summary = counterpartSummary && counterpartSummary.id === counterpartId && counterpartSummary.fullName
      ? (counterpartSummary as UserSummary)
      : (await this.users.getSummaries([counterpartId])).get(counterpartId);
    return toConversationDto(conversation, side, summary);
  }

  private async publishAgency(conversation: ConversationRecord, message: MessageRecord, exceptUserId?: string): Promise<void> {
    if (!conversation.agencyId) return;
    for (const memberId of await this.chat.listAgencyChatUserIds(conversation.agencyId)) {
      if (memberId !== exceptUserId) this.publish(memberId, conversation.id, toMessageDto(message, memberId));
    }
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
