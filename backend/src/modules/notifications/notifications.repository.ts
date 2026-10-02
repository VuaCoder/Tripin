import type { QueryFilter } from 'mongoose';
import { toSkip, type PageRequest } from '../../utils/pagination';
import { NotificationModel, type NotificationAttributes, type NotificationDocument } from './notifications.model';

export class NotificationsRepository {
  create(data: Partial<NotificationAttributes>): Promise<NotificationDocument> {
    return NotificationModel.create(data);
  }

  insertMany(data: Partial<NotificationAttributes>[]): Promise<NotificationDocument[]> {
    return NotificationModel.insertMany(data) as unknown as Promise<NotificationDocument[]>;
  }

  /** Scoped to the owner: another user's notification id is simply "not found". */
  findOwned(id: string, userId: string): Promise<NotificationDocument | null> {
    return NotificationModel.findOne({ _id: id, userId }).exec();
  }

  async list(userId: string, unreadOnly: boolean, page: PageRequest) {
    const filter: QueryFilter<NotificationAttributes> = { userId };
    if (unreadOnly) filter.readAt = { $exists: false };
    const [items, total] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(toSkip(page)).limit(page.limit).exec(),
      NotificationModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  countUnread(userId: string): Promise<number> {
    return NotificationModel.countDocuments({ userId, readAt: { $exists: false } }).exec();
  }

  markRead(id: string, userId: string): Promise<NotificationDocument | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: id, userId, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
      { returnDocument: 'after' },
    ).exec();
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await NotificationModel.updateMany({ userId, readAt: { $exists: false } }, { $set: { readAt: new Date() } }).exec();
    return result.modifiedCount;
  }
}

export const notificationsRepository = new NotificationsRepository();
