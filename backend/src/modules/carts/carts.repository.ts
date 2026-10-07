import { prisma } from '../../config/database';
import type { CartItem } from '../../generated/prisma/client';

export type CartItemRecord = CartItem;

export interface UpsertCartItemInput {
  userId: string;
  tourId: string;
  departureId: string;
  participants: number;
}

export class CartsRepository {
  /** Inserts the line, or replaces the head-count when the traveler already has that departure (unique `(userId, departureId)`). */
  upsert(input: UpsertCartItemInput): Promise<CartItemRecord> {
    const { userId, tourId, departureId, participants } = input;
    return prisma.cartItem.upsert({
      where: { userId_departureId: { userId, departureId } },
      create: { userId, tourId, departureId, participants },
      update: { participants },
    });
  }

  findById(id: string): Promise<CartItemRecord | null> {
    return prisma.cartItem.findUnique({ where: { id } });
  }

  async exists(userId: string, departureId: string): Promise<boolean> {
    return (await prisma.cartItem.count({ where: { userId, departureId } })) > 0;
  }

  count(userId: string): Promise<number> {
    return prisma.cartItem.count({ where: { userId } });
  }

  /** Compare-and-set on ownership; null when the line disappeared between the read and the write. */
  async updateParticipants(userId: string, id: string, participants: number): Promise<CartItemRecord | null> {
    const result = await prisma.cartItem.updateMany({ where: { id, userId }, data: { participants } });
    return result.count === 1 ? prisma.cartItem.findUnique({ where: { id } }) : null;
  }

  /** Returns true if a row was deleted. Scoped to the owner, so a foreign id is a silent no-op. */
  async remove(userId: string, id: string): Promise<boolean> {
    const result = await prisma.cartItem.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }

  listByUser(userId: string): Promise<CartItemRecord[]> {
    return prisma.cartItem.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  }
}

export const cartsRepository = new CartsRepository();
