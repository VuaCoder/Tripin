import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { Notification } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { NOTIFICATION_TYPE } from './notifications.types';
import { agencyNotificationPermission } from './notifications.policy';
import { memberHasAgencyPermission } from '../agencies/agency-access.query';

/** A stored notification; `data` is a free-form string map. */
export type NotificationRecord = Omit<Notification, 'data'> & { data: Record<string, string> | null };

export type NewNotification = Pick<Notification, 'userId' | 'type' | 'title' | 'body'> & { agencyId?: string; data?: Record<string, string> };

function toRecord(row: Notification): NotificationRecord {
  return { ...row, data: (row.data as Record<string, string> | null) ?? null };
}

const toRow = (data: NewNotification): Prisma.NotificationUncheckedCreateInput => ({ ...data, data: data.data });

/** Personal history stays personal; agency rows require current membership. */
const visibleTo = (userId: string, agencyId?: string): Prisma.NotificationWhereInput => ({ userId, ...(agencyId ? { agencyId } : {}), OR: [
  { agencyId: null },
  ...Object.values(NOTIFICATION_TYPE).flatMap(type => {
    const permission = agencyNotificationPermission(type);
    return permission ? [{
    type,
    agency: { members: { some: { userId, status: 'ACTIVE' as const, user: { status: 'ACTIVE' as const, staffStatus: 'ACTIVE' }, ...memberHasAgencyPermission(permission) } } },
    }] : [];
  }),
] });

export class NotificationsRepository {
  async create(data: NewNotification): Promise<NotificationRecord> {
    return toRecord(await prisma.notification.create({ data: toRow(data) }));
  }

  async insertMany(data: NewNotification[]): Promise<NotificationRecord[]> {
    return (await prisma.notification.createManyAndReturn({ data: data.map(toRow) })).map(toRecord);
  }

  /** Scoped to the owner: another user's notification id is simply "not found". */
  async findOwned(id: string, userId: string, agencyId?: string): Promise<NotificationRecord | null> {
    const row = await prisma.notification.findFirst({ where: { id, ...visibleTo(userId, agencyId) } });
    return row ? toRecord(row) : null;
  }

  async list(userId: string, unreadOnly: boolean, page: PageRequest, agencyId?: string) {
    const where: Prisma.NotificationWhereInput = { ...visibleTo(userId, agencyId), ...(unreadOnly ? { readAt: null } : {}) };
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.notification.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }

  countUnread(userId: string, agencyId?: string): Promise<number> {
    return prisma.notification.count({ where: { ...visibleTo(userId, agencyId), readAt: null } });
  }

  async markRead(id: string, userId: string, agencyId?: string): Promise<NotificationRecord | null> {
    const row = await prisma.notification.update({ where: { ...visibleTo(userId, agencyId), id, readAt: null }, data: { readAt: new Date() } }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  /** Notifications created before `before` (retention policy, applied by a periodic job). */
  async deleteCreatedBefore(before: Date): Promise<number> {
    return (await prisma.notification.deleteMany({ where: { createdAt: { lt: before } } })).count;
  }

  async markAllRead(userId: string, agencyId?: string): Promise<number> {
    const result = await prisma.notification.updateMany({ where: { ...visibleTo(userId, agencyId), readAt: null }, data: { readAt: new Date() } });
    return result.count;
  }

  async deleteOwned(id: string, userId: string, agencyId?: string): Promise<boolean> {
    return (await prisma.notification.deleteMany({ where: { id, ...visibleTo(userId, agencyId) } })).count > 0;
  }

  async hasRecentVoucherAlert(userId: string, voucherId: string, since: Date): Promise<boolean> {
    const found = await prisma.notification.findFirst({
      where: {
        userId,
        type: { in: ['VOUCHER_EXPIRING_SOON', 'VOUCHER_EXPIRING_URGENT'] },
        createdAt: { gte: since },
        data: { path: ['voucherId'], equals: voucherId },
      },
    });
    return Boolean(found);
  }
}

export const notificationsRepository = new NotificationsRepository();
