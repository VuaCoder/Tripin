import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ notification: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('../../../config/database', () => ({ prisma: db, nullIfNotFound: () => null }));
import { NotificationsRepository } from '../notifications.repository';

const repository = new NotificationsRepository();
beforeEach(() => {
  vi.clearAllMocks(); db.notification.findMany.mockResolvedValue([]); db.notification.count.mockResolvedValue(0);
  db.notification.findFirst.mockResolvedValue(null); db.notification.update.mockResolvedValue({ id: 'notification', data: null });
  db.notification.updateMany.mockResolvedValue({ count: 0 }); db.notification.deleteMany.mockResolvedValue({ count: 0 });
});
describe('Agency notification scope never broadens the personal visibility policy', () => {
  it.each(['list','countUnread','findOwned','markRead','markAllRead','deleteOwned'] as const)('scopes %s to both actor and selected agency', async method => {
    if (method === 'list') await repository.list('actor', false, { page: 1, limit: 20 }, 'agency-a');
    else if (method === 'countUnread' || method === 'markAllRead') await repository[method]('actor', 'agency-a');
    else await repository[method]('notification', 'actor', 'agency-a');
    const operation = { list: 'findMany', countUnread: 'count', findOwned: 'findFirst', markRead: 'update', markAllRead: 'updateMany', deleteOwned: 'deleteMany' }[method] as keyof typeof db.notification;
    expect(db.notification[operation]).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'actor', agencyId: 'agency-a', OR: expect.any(Array) }) }));
    const where = db.notification[operation].mock.calls[0][0].where;
    expect(where.OR).toEqual(expect.arrayContaining([expect.objectContaining({ agency: expect.objectContaining({ members: expect.objectContaining({ some: expect.objectContaining({ userId: 'actor', status: 'ACTIVE' }) }) }) })]));
  });
  it('keeps the existing personal inbox contract when no agency scope is requested', async () => {
    await repository.list('actor', false, { page: 1, limit: 20 });
    expect(db.notification.findMany.mock.calls[0][0].where.agencyId).toBeUndefined();
  });
});
