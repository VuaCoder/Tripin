import { prisma } from '../../config/database';
import type { WishlistItem } from '../../generated/prisma/client';
import { AppError } from '../../utils/app-error';
import { toSkip, type PageRequest } from '../../utils/pagination';

export type WishlistItemRecord = WishlistItem;

export class WishlistsRepository {
  /** Inserts when missing. Returns `true` if a new row was created, `false` if it already existed. */
  async addIfAbsent(userId: string, tourId: string): Promise<boolean> {
    const result = await prisma.wishlistItem.createMany({ data: [{ userId, tourId }], skipDuplicates: true });
    return result.count === 1;
  }

  /**
   * Cap-aware add under a row lock so concurrent inserts cannot race past `maxItems`.
   * Throws AppError.conflict with code `WISHLIST_FULL` when the cap would be exceeded.
   */
  async addWithCap(
    userId: string,
    tourId: string,
    maxItems: number,
  ): Promise<{ created: boolean }> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "WishlistItem" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
      const count = await tx.wishlistItem.count({ where: { userId } });
      const exists = await tx.wishlistItem.count({ where: { userId, tourId } });
      if (exists > 0) return { created: false };
      if (count >= maxItems) {
        throw AppError.conflict(`Your wishlist is full (${maxItems} tours)`, 'WISHLIST_FULL');
      }
      await tx.wishlistItem.create({ data: { userId, tourId } });
      return { created: true };
    });
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
