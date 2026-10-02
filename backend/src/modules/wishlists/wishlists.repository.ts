import { prisma } from '../../config/database';
import type { WishlistItem } from '../../generated/prisma/client';
import { toSkip, type PageRequest } from '../../utils/pagination';

export type WishlistItemRecord = WishlistItem;

export class WishlistsRepository {
  /** Inserts when missing. Returns `true` if a new row was created, `false` if it already existed. */
  async addIfAbsent(userId: string, tourId: string): Promise<boolean> {
    const result = await prisma.wishlistItem.createMany({ data: [{ userId, tourId }], skipDuplicates: true });
    return result.count === 1;
  }

  async exists(userId: string, tourId: string): Promise<boolean> {
    return (await prisma.wishlistItem.count({ where: { userId, tourId } })) > 0;
  }

  count(userId: string): Promise<number> {
    return prisma.wishlistItem.count({ where: { userId } });
  }

  /** Returns true if something was deleted. */
  async remove(userId: string, tourId: string): Promise<boolean> {
    const result = await prisma.wishlistItem.deleteMany({ where: { userId, tourId } });
    return result.count === 1;
  }

  async list(userId: string, page: PageRequest): Promise<{ items: WishlistItemRecord[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.wishlistItem.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: toSkip(page), take: page.limit }),
      prisma.wishlistItem.count({ where: { userId } }),
    ]);
    return { items, total };
  }
}

export const wishlistsRepository = new WishlistsRepository();
