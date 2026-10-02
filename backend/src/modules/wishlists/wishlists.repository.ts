import { toSkip, type PageRequest } from '../../utils/pagination';
import { WishlistItemModel, type WishlistItemDocument } from './wishlists.model';

export class WishlistsRepository {
  /** Inserts when missing. Returns `true` if a new row was created, `false` if it already existed. */
  async addIfAbsent(userId: string, tourId: string): Promise<boolean> {
    const result = await WishlistItemModel.updateOne(
      { userId, tourId },
      { $setOnInsert: { userId, tourId, createdAt: new Date() } },
      { upsert: true },
    ).exec();
    return result.upsertedCount === 1;
  }

  exists(userId: string, tourId: string): Promise<boolean> {
    return WishlistItemModel.exists({ userId, tourId }).then(Boolean);
  }

  count(userId: string): Promise<number> {
    return WishlistItemModel.countDocuments({ userId }).exec();
  }

  /** Returns true if something was deleted. */
  async remove(userId: string, tourId: string): Promise<boolean> {
    const result = await WishlistItemModel.deleteOne({ userId, tourId }).exec();
    return result.deletedCount === 1;
  }

  async list(userId: string, page: PageRequest): Promise<{ items: WishlistItemDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      WishlistItemModel.find({ userId }).sort({ createdAt: -1, _id: -1 }).skip(toSkip(page)).limit(page.limit).exec(),
      WishlistItemModel.countDocuments({ userId }).exec(),
    ]);
    return { items, total };
  }
}

export const wishlistsRepository = new WishlistsRepository();
