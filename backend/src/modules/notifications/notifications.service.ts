import { mailProvider, type MailProvider } from '../../integrations/mail';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { logger } from '../../utils/logger';
import { usersService, type UsersService } from '../users';
import { toNotificationDto } from './notifications.mapper';
import { notificationsRepository, type NotificationsRepository } from './notifications.repository';
import type {
  ListNotificationsQuery,
  NotificationDto,
  NotificationPublisher,
  NotifyInput,
  NotifyOptions,
} from './notifications.types';

export class NotificationsService {
  private publisher?: NotificationPublisher;

  constructor(
    private readonly notifications: Pick<
      NotificationsRepository,
      'create' | 'insertMany' | 'findOwned' | 'list' | 'countUnread' | 'markRead' | 'markAllRead' | 'deleteCreatedBefore'
    > = notificationsRepository,
    private readonly users: Pick<UsersService, 'getContact'> = usersService,
    private readonly mail: MailProvider = mailProvider,
  ) {}

  /** Lets the realtime layer push each new notification to the user's connected clients. */
  setPublisher(publisher: NotificationPublisher | undefined): void {
    this.publisher = publisher;
  }

  // ----------------------------------------------- Used by other modules

  /**
   * Stores an in-app notification (and optionally emails it). NEVER throws: a failed notification must not break the
   * business action that triggered it — failures are logged instead.
   */
  async notify(userId: string, input: NotifyInput, options: NotifyOptions = {}): Promise<void> {
    try {
      const { data, ...rest } = input;
      const created = await this.notifications.create({
        userId,
        ...rest,
        data,
      });
      this.publish(userId, toNotificationDto(created));
      if (options.email) await this.sendEmail(userId, input);
    } catch (error) {
      logger.error(`Notification failed (${input.type})`, { message: (error as Error).message });
    }
  }

  /** Retention (periodic job): deletes notifications older than `retentionDays`. Returns how many were removed. */
  purgeOlderThan(retentionDays: number, now = new Date()): Promise<number> {
    return this.notifications.deleteCreatedBefore(new Date(now.getTime() - retentionDays * 86_400_000));
  }

  /** Same content to several users (de-duplicated). Never throws. */
  async notifyMany(userIds: string[], input: NotifyInput, options: NotifyOptions = {}): Promise<void> {
    await Promise.all(Array.from(new Set(userIds)).map((userId) => this.notify(userId, input, options)));
  }

  // ------------------------------------------------------- Own inbox

  async list(userId: string, query: ListNotificationsQuery): Promise<Page<NotificationDto>> {
    const { items, total } = await this.notifications.list(userId, query.unreadOnly ?? false, query);
    return buildPage(items.map(toNotificationDto), total, query);
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    return { unread: await this.notifications.countUnread(userId) };
  }

  /** Idempotent: marking an already-read notification returns it unchanged. */
  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const updated = await this.notifications.markRead(id, userId);
    if (updated) return toNotificationDto(updated);
    const existing = await this.notifications.findOwned(id, userId);
    if (!existing) throw AppError.notFound('Notification not found');
    return toNotificationDto(existing);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(userId) };
  }

  // ---------------------------------------------------------- helpers

  private publish(userId: string, dto: NotificationDto): void {
    try {
      this.publisher?.(userId, dto);
    } catch (error) {
      logger.warn('Notification publisher failed', { message: (error as Error).message });
    }
  }

  private async sendEmail(userId: string, input: NotifyInput): Promise<void> {
    const contact = await this.users.getContact(userId);
    if (!contact) return;
    await this.mail.send({ to: contact.email, subject: input.title, text: `Hello ${contact.fullName},\n\n${input.body}\n\n— Tripri` });
  }
}

export const notificationsService = new NotificationsService();
