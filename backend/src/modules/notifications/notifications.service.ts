import { mailProvider, type MailProvider } from '../../integrations/mail';
import { buildNotificationMail } from './notifications.mail';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { logger } from '../../utils/logger';
import { usersService, type UsersService } from '../users';
import { toNotificationDto } from './notifications.mapper';
import { vietnameseNotification } from './notifications.locale';
import { notificationsRepository, type NotificationsRepository } from './notifications.repository';
import { prisma } from '../../config/database';
import { writeAgencyNotification } from './notifications.writer';
import { canReceiveAgencyNotification } from './notifications.policy';
import { agencyAccessInclude, effectiveAgencyPermissions } from '../agencies/agency.policy';
import { NOTIFICATION_TYPE } from './notifications.types';
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
      'create' | 'insertMany' | 'findOwned' | 'list' | 'countUnread' | 'markRead' | 'markAllRead' | 'deleteCreatedBefore' | 'deleteOwned' | 'hasRecentVoucherAlert'
    > = notificationsRepository,
    // `users` is cyclic with this module: resolve it on first use, not at construction.
    private readonly users?: Pick<UsersService, 'getContact'>,
    private readonly mail: MailProvider = mailProvider,
  ) {}

  /** Lets the realtime layer push each new notification to the user's connected clients. */
  setPublisher(publisher: NotificationPublisher | undefined): void {
    this.publisher = publisher;
  }

  // ----------------------------------------------- Used by other modules

  /** Explicit organization recipient, never a legacy User.id fallback. */
  async notifyAgency(agencyId: string, input: NotifyInput, options: NotifyOptions = {}): Promise<void> {
    try {
      const localized = { ...input, ...vietnameseNotification(input.title, input.body) };
      const rows = await prisma.$transaction(tx => writeAgencyNotification(tx, agencyId, localized, options.email ?? false));
      for (const row of rows) await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id = ${agencyId}::uuid FOR UPDATE`;
        const member = await tx.agencyMember.findFirst({ where: { agencyId, userId: row.userId, status: 'ACTIVE', user: { status: 'ACTIVE', staffStatus: 'ACTIVE' } }, include: agencyAccessInclude });
        if (member && canReceiveAgencyNotification(effectiveAgencyPermissions(member), row.type)) {
          this.publish(row.userId, toNotificationDto({ ...row, data: row.data as Record<string, string> | null }));
        }
      });
      if (input.type === NOTIFICATION_TYPE.COMPLAINT_RECEIVED || input.type === NOTIFICATION_TYPE.CUSTOM_TOUR_REQUESTED) {
        await this.notifyAdmins({ type: NOTIFICATION_TYPE.ADMIN_REQUEST_RECEIVED, title: input.title, body: input.body, data: input.data });
      }
    } catch (error) {
      logger.error(`Agency notification failed (${input.type})`, { message: (error as Error).message });
    }
  }

  /**
   * Stores an in-app notification (and optionally emails it). NEVER throws: a failed notification must not break the
   * business action that triggered it — failures are logged instead.
   */
  async notify(userId: string, input: NotifyInput, options: NotifyOptions = {}): Promise<void> {
    try {
      const localized = { ...input, ...vietnameseNotification(input.title, input.body) };
      const { data, ...rest } = localized;
      const created = await this.notifications.create({
        userId,
        ...rest,
        data,
      });
      this.publish(userId, toNotificationDto(created));
      if (input.type === NOTIFICATION_TYPE.BOOKING_CREATED) {
        await this.notifyAdmins({ type: NOTIFICATION_TYPE.ADMIN_REQUEST_RECEIVED, title: input.title, body: input.body, data: input.data });
      }
      if (options.email) await this.sendEmail(userId, localized);
    } catch (error) {
      logger.error(`Notification failed (${input.type})`, { message: (error as Error).message });
    }
  }

  hasRecentVoucherAlert(userId: string, voucherId: string, since: Date): Promise<boolean> {
    return this.notifications.hasRecentVoucherAlert(userId, voucherId, since);
  }

  /** Retention (periodic job): deletes notifications older than `retentionDays`. Returns how many were removed. */
  purgeOlderThan(retentionDays: number, now = new Date()): Promise<number> {
    return this.notifications.deleteCreatedBefore(new Date(now.getTime() - retentionDays * 86_400_000));
  }

  /** Same content to several users (de-duplicated). Never throws. */
  async notifyMany(userIds: string[], input: NotifyInput, options: NotifyOptions = {}): Promise<void> {
    await Promise.all(Array.from(new Set(userIds)).map((userId) => this.notify(userId, input, options)));
  }

  /** Fan out incoming user requests to active Super Admin inboxes; each is then pushed through notification:new. */
  async notifyAdmins(input: NotifyInput): Promise<void> {
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN', status: 'ACTIVE', staffStatus: 'ACTIVE' },
        select: { id: true },
      });
      await this.notifyMany(admins.map(({ id }) => id), input);
    } catch (error) {
      logger.error(`Admin notification failed (${input.type})`, { message: (error as Error).message });
    }
  }

  // ------------------------------------------------------- Own inbox

  async list(userId: string, query: ListNotificationsQuery, agencyId?: string): Promise<Page<NotificationDto>> {
    const { items, total } = await this.notifications.list(userId, query.unreadOnly ?? false, query, ...(agencyId ? [agencyId] : []));
    return buildPage(items.map(toNotificationDto), total, query);
  }

  async unreadCount(userId: string, agencyId?: string): Promise<{ unread: number }> {
    return { unread: await this.notifications.countUnread(userId, ...(agencyId ? [agencyId] : [])) };
  }

  /** Idempotent: marking an already-read notification returns it unchanged. */
  async markRead(userId: string, id: string, agencyId?: string): Promise<NotificationDto> {
    const updated = await this.notifications.markRead(id, userId, ...(agencyId ? [agencyId] : []));
    if (updated) return toNotificationDto(updated);
    const existing = await this.notifications.findOwned(id, userId, ...(agencyId ? [agencyId] : []));
    if (!existing) throw AppError.notFound('Notification not found');
    return toNotificationDto(existing);
  }

  async markAllRead(userId: string, agencyId?: string): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(userId, ...(agencyId ? [agencyId] : [])) };
  }

  async remove(userId: string, id: string, agencyId?: string): Promise<{ deleted: true }> {
    if (!await this.notifications.deleteOwned(id, userId, ...(agencyId ? [agencyId] : []))) throw AppError.notFound('Notification not found');
    return { deleted: true };
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
    const contact = await (this.users ?? usersService).getContact(userId);
    if (!contact) return;
    await this.mail.send(buildNotificationMail(contact, input));
  }
}

export const notificationsService = new NotificationsService();
