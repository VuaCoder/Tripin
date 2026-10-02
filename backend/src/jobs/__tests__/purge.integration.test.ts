import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../config/database';
import { authService } from '../../modules/auth';
import { notificationsService } from '../../modules/notifications';
import { createUser, resetDatabase, startDatabase, stopDatabase } from '../../test/integration';

// PostgreSQL has no TTL indexes: expiry of one-time codes, refresh tokens and old notifications is a job.
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const ago = (ms: number) => new Date(Date.now() - ms);
const DAY = 86_400_000;

describe('retention jobs (integration)', () => {
  it('removes only expired one-time codes and refresh tokens', async () => {
    const user = await createUser('TRAVELER', 'a@example.com');
    await prisma.otp.createMany({
      data: [
        { userId: user.id, purpose: 'REGISTER', codeHash: 'x', issuedAt: ago(DAY), expiresAt: ago(1000) },
        { userId: user.id, purpose: 'LOGIN_2FA', codeHash: 'y', issuedAt: new Date(), expiresAt: new Date(Date.now() + 600_000) },
      ],
    });
    await prisma.refreshToken.createMany({
      data: [
        { userId: user.id, tokenHash: 'old', family: 'f1', expiresAt: ago(1000), revokedAt: ago(5000) },
        { userId: user.id, tokenHash: 'live', family: 'f2', expiresAt: new Date(Date.now() + DAY) },
      ],
    });
    expect(await authService.purgeExpiredCredentials()).toBe(2);
    expect((await prisma.otp.findMany()).map((o) => o.purpose)).toEqual(['LOGIN_2FA']);
    expect((await prisma.refreshToken.findMany()).map((t) => t.tokenHash)).toEqual(['live']);
    expect(await authService.purgeExpiredCredentials()).toBe(0);
  });

  it('keeps notifications for the retention period only', async () => {
    const user = await createUser('TRAVELER', 'b@example.com');
    const base = { userId: user.id, type: 'BOOKING_CREATED' as const, title: 't', body: 'b' };
    await prisma.notification.createMany({
      data: [
        { ...base, createdAt: ago(200 * DAY) },
        { ...base, createdAt: ago(179 * DAY) },
        { ...base, createdAt: new Date() },
      ],
    });
    expect(await notificationsService.purgeOlderThan(180)).toBe(1);
    expect(await prisma.notification.count()).toBe(2);
  });
});
