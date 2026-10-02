import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { Notification } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';

/** A stored notification; `data` is a free-form string map. */
export type NotificationRecord = Omit<Notification, 'data'> & { data: Record<string, string> | null };

export type NewNotification = Pick<Notification, 'userId' | 'type' | 'title' | 'body'> & { data?: Record<string, string> };

function toRecord(row: Notification): NotificationRecord {
  return { ...row, data: (row.data as Record<string, string> | null) ?? null };
}

const toRow = (data: NewNotification): Prisma.NotificationUncheckedCreateInput => ({ ...data, data: data.data });

export class NotificationsRepository {
  async create(data: NewNotification): Promise<NotificationRecord> {
    return toRecord(await prisma.notification.create({ data: toRow(data) }));
  }

  async insertMany(data: NewNotification[]): Promise<NotificationRecord[]> {
    return (await prisma.notification.createManyAndReturn({ data: data.map(toRow) })).map(toRecord);
  }

  /** Scoped to the owner: another user's notification id is simply "not found". */
  async findOwned(id: string, userId: string): Promise<NotificationRecord | null> {
    const row = await prisma.notification.findFirst({ where: { id, userId } });
    return row ? toRecord(row) : null;
  }

  async list(userId: string, unreadOnly: boolean, page: PageRequest) {
    const where: Prisma.NotificationWhereInput = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.notification.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }

  countUnread(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string): Promise<NotificationRecord | null> {
    const row = await prisma.notification.update({ where: { id, userId, readAt: null }, data: { readAt: new Date() } }).catch(nullIfNotFound);
    return row ? toRecord(row) : null;
  }

  /** Notifications created before `before` (retention policy, applied by a periodic job). */
  async deleteCreatedBefore(before: Date): Promise<number> {
    return (await prisma.notification.deleteMany({ where: { createdAt: { lt: before } } })).count;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return result.count;
  }
}

export const notificationsRepository = new NotificationsRepository();
