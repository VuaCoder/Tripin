import { describe, expect, it, vi } from 'vitest';
import { ROLES } from '@travel-platform/constants';
import { AuditService } from '../audit.service';
import { AUDIT_ACTIONS } from '../audit.types';

const entry = {
  actorId: '507f1f77bcf86cd799439011',
  actorRole: ROLES.MODERATOR,
  action: AUDIT_ACTIONS.USER_BANNED,
  targetType: 'user',
  targetId: 'u2',
  metadata: { reason: 'spam' },
} as const;

describe('AuditService', () => {
  it('stores the entry', async () => {
    const create = vi.fn(async () => ({}));
    await new AuditService({ create, list: vi.fn() } as never).record(entry);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.banned', targetId: 'u2' }));
  });

  it('never throws when the trail cannot be written (the business action already happened)', async () => {
    const create = vi.fn(async () => {
      throw new Error('db down');
    });
    await expect(new AuditService({ create, list: vi.fn() } as never).record(entry)).resolves.toBeUndefined();
  });

  it('lists with pagination meta and maps documents to DTOs', async () => {
    const doc = { id: 'a1', actorId: 'x', actorRole: 'MODERATOR', action: 'user.banned', targetType: 'user', createdAt: new Date('2026-01-01') };
    const list = vi.fn(async () => ({ items: [doc], total: 41 }));
    const page = await new AuditService({ create: vi.fn(), list } as never).list({ page: 2, limit: 20, targetType: 'user' });
    expect(list).toHaveBeenCalledWith({ targetType: 'user' }, { page: 2, limit: 20 });
    expect(page.meta).toEqual({ page: 2, limit: 20, total: 41, totalPages: 3 });
    expect(page.items[0]).toMatchObject({ id: 'a1', createdAt: '2026-01-01T00:00:00.000Z' });
  });
});
