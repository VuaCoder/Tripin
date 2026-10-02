import { nullIfNotFound, prisma } from '../../config/database';
import type { RefreshToken } from '../../generated/prisma/client';

export type RefreshTokenRecord = RefreshToken;

export class RefreshTokenRepository {
  create(data: Pick<RefreshTokenRecord, 'userId' | 'tokenHash' | 'family' | 'expiresAt'> & Partial<Pick<RefreshTokenRecord, 'ip' | 'userAgent'>>) {
    return prisma.refreshToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /** Atomically revokes a still-active token; returns null if it was already revoked (rotation race / reuse). */
  revokeIfActive(id: string): Promise<RefreshTokenRecord | null> {
    return prisma.refreshToken.update({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }).catch(nullIfNotFound);
  }

  /** Tokens past their expiry: reuse detection no longer needs them (a periodic job removes them). */
  async deleteExpired(now: Date): Promise<number> {
    return (await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  }

  revokeFamily(family: string): Promise<unknown> {
    return prisma.refreshToken.updateMany({ where: { family, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  revokeAllForUser(userId: string): Promise<unknown> {
    return prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
