import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from '../notifications.service';
import { NOTIFICATION_TYPE } from '../notifications.types';

const doc = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  type: NOTIFICATION_TYPE.TOUR_APPROVED,
  title: 'T',
  body: 'B',
  createdAt: new Date('2026-01-01'),
  ...over,
});

function make() {
  const repo = {
    create: vi.fn(async () => doc()),
    insertMany: vi.fn(),
    findOwned: vi.fn(async () => null as unknown),
    list: vi.fn(async () => ({ items: [doc()], total: 45 })),
    countUnread: vi.fn(async () => 3),
    markRead: vi.fn(async () => null as unknown),
    markAllRead: vi.fn(async () => 5),
  };
  const users = { getContact: vi.fn(async () => ({ email: 'a@b.com', fullName: 'Ann' })) };
  const mail = { send: vi.fn(async () => undefined) };
  return { service: new NotificationsService(repo as never, users as never, mail), repo, users, mail };
}

const input = { type: NOTIFICATION_TYPE.TOUR_APPROVED, title: 'Approved', body: 'Your tour is public', data: { tourId: 't1' } };

describe('notify', () => {
  it('stores the notification for the user without emailing by default', async () => {
    const { service, repo, mail } = make();
    await service.notify('u1', input);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', title: 'Approved' }));
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('also emails when asked, using the account address', async () => {
    const { service, mail } = make();
    await service.notify('u1', input, { email: true });
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.com', subject: 'Approved' }));
  });

  it('skips the email for accounts that are gone or inactive', async () => {
    const { service, users, mail } = make();
    users.getContact.mockResolvedValueOnce(null as never);
    await service.notify('u1', input, { email: true });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('never throws, even when storage or mail fail', async () => {
    const failing = make();
    failing.repo.create.mockRejectedValueOnce(new Error('db down'));
    await expect(failing.service.notify('u1', input)).resolves.toBeUndefined();
    const mailFail = make();
    mailFail.mail.send.mockRejectedValueOnce(new Error('smtp down'));
    await expect(mailFail.service.notify('u1', input, { email: true })).resolves.toBeUndefined();
  });

  it('pushes to the realtime publisher, and a broken publisher does not matter', async () => {
    const { service } = make();
    const publisher = vi.fn();
    service.setPublisher(publisher);
    await service.notify('u1', input);
    expect(publisher).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'n1', isRead: false }));
    service.setPublisher(() => {
      throw new Error('socket closed');
    });
    await expect(service.notify('u1', input)).resolves.toBeUndefined();
  });

  it('notifyMany de-duplicates recipients', async () => {
    const { service, repo } = make();
    await service.notifyMany(['u1', 'u2', 'u1'], input);
    expect(repo.create).toHaveBeenCalledTimes(2);
  });
});

describe('inbox', () => {
  it('lists with pagination meta, scoped to the user', async () => {
    const { service, repo } = make();
    const page = await service.list('u1', { page: 2, limit: 20, unreadOnly: true });
    expect(repo.list).toHaveBeenCalledWith('u1', true, { page: 2, limit: 20, unreadOnly: true });
    expect(page.meta).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
  });

  it('marks read idempotently and hides other users\' notifications behind 404', async () => {
    const { service, repo } = make();
    repo.markRead.mockResolvedValueOnce(doc({ readAt: new Date() }));
    expect((await service.markRead('u1', 'n1')).isRead).toBe(true);
    repo.findOwned.mockResolvedValueOnce(doc({ readAt: new Date() }));
    expect((await service.markRead('u1', 'n1')).isRead).toBe(true); // already read -> unchanged, still 200
    await expect(service.markRead('u1', 'someone-elses')).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.markRead).toHaveBeenLastCalledWith('someone-elses', 'u1');
  });

  it('reports unread count and mark-all', async () => {
    const { service } = make();
    expect(await service.unreadCount('u1')).toEqual({ unread: 3 });
    expect(await service.markAllRead('u1')).toEqual({ updated: 5 });
  });
});
