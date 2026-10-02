import { RefreshTokenModel, type RefreshTokenAttributes, type RefreshTokenDocument } from './refresh-token.model';

export class RefreshTokenRepository {
  create(data: Pick<RefreshTokenAttributes, 'userId' | 'tokenHash' | 'family' | 'expiresAt' | 'ip' | 'userAgent'>) {
    return RefreshTokenModel.create(data);
  }

  findByHash(tokenHash: string): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({ tokenHash }).exec();
  }

  /** Atomically revokes a still-active token; returns null if it was already revoked (rotation race / reuse). */
  revokeIfActive(id: string): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOneAndUpdate(
      { _id: id, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
      { returnDocument: 'after' },
    ).exec();
  }

  revokeFamily(family: string): Promise<unknown> {
    return RefreshTokenModel.updateMany({ family, revokedAt: { $exists: false } }, { revokedAt: new Date() }).exec();
  }

  revokeAllForUser(userId: string): Promise<unknown> {
    return RefreshTokenModel.updateMany({ userId, revokedAt: { $exists: false } }, { revokedAt: new Date() }).exec();
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
