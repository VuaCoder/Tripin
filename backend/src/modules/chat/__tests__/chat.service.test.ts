import { describe, expect, it, vi } from 'vitest';
import { ROLES } from '@travel-platform/constants';
import { canConverse } from '../chat.policy';
import { ChatService } from '../chat.service';

type C = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const traveler = { userId: 't1', role: ROLES.TRAVELER } as const;
const guide = { userId: 'g1', role: ROLES.TOUR_GUIDE } as const;

function conv(over: C = {}): C {
  return { id: 'c1', travelerId: 't1', guideId: 'g1', unreadTraveler: 0, unreadGuide: 0, lastActivityAt: new Date(), ...over };
}

function make(seed: C[] = []) {
  const db = [...seed];
  const messages: C[] = [];
  const repo = {
    findConversation: vi.fn(async (id: string) => db.find((c) => c.id === id) ?? null),
    findByPair: vi.fn(async (t: string, g: string) => db.find((c) => c.travelerId === t && c.guideId === g) ?? null),
    createConversation: vi.fn(async (data: C) => {
      const doc = conv({ ...data, id: `c${db.length + 1}` });
      db.push(doc);
      return doc;
    }),
    listConversations: vi.fn(async () => ({ items: db, total: db.length })),
    recordMessage: vi.fn(async (id: string, recipient: string, last: C) => {
      const doc = db.find((c) => c.id === id)!;
      const before = { ...doc };
      doc.lastMessage = last;
      if (recipient === 'traveler') doc.unreadTraveler += 1;
      else doc.unreadGuide += 1;
      return before;
    }),
    resetUnread: vi.fn(async () => undefined),
    createMessage: vi.fn(async (data: C) => {
      const m = { id: `m${messages.length + 1}`, createdAt: new Date(), ...data };
      messages.push(m);
      return m;
    }),
    listMessages: vi.fn(async () => ({ items: [...messages].reverse(), hasMore: false })),
    markMessagesRead: vi.fn(async () => undefined),
  };
  const users = {
    assertActiveWithRole: vi.fn(async (id: string) => ({ id })),
    getSummaries: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, fullName: `User ${id}`, role: id.startsWith('g') ? 'TOUR_GUIDE' : 'TRAVELER' }]))),
  };
  const notifications = { notify: vi.fn(async () => undefined) };
  return { service: new ChatService(repo as never, users as never, notifications), repo, users, notifications, db, messages };
}

describe('policy', () => {
  it('allows only traveler <-> tour guide', () => {
    expect(canConverse('TRAVELER', 'TOUR_GUIDE')).toBe(true);
    expect(canConverse('TOUR_GUIDE', 'TRAVELER')).toBe(true);
    for (const [a, b] of [['TRAVELER', 'TRAVELER'], ['TRAVELER', 'AGENCY'], ['AGENCY', 'TOUR_GUIDE'], ['MODERATOR', 'TRAVELER'], ['TOUR_GUIDE', 'TOUR_GUIDE']] as const) {
      expect(canConverse(a, b)).toBe(false);
    }
  });
});

describe('startConversation', () => {
  it('a traveler opens a conversation with an active guide; the pair is stored in the right slots', async () => {
    const { service, repo, users } = make();
    const dto = await service.startConversation(traveler, { participantId: 'g1', tourId: 'tour1' });
    expect(users.assertActiveWithRole).toHaveBeenCalledWith('g1', 'TOUR_GUIDE');
    expect(repo.createConversation).toHaveBeenCalledWith(expect.objectContaining({ travelerId: 't1', guideId: 'g1', tourId: 'tour1' }));
    expect(dto.counterpart).toMatchObject({ id: 'g1', fullName: 'User g1' });
  });

  it('a guide can open it too, with the roles swapped; it is the same conversation', async () => {
    const { service, repo } = make();
    await service.startConversation(traveler, { participantId: 'g1' });
    const again = await service.startConversation(guide, { participantId: 't1' });
    expect(repo.createConversation).toHaveBeenCalledTimes(1);
    expect(again.counterpart?.id).toBe('t1');
  });

  it('is idempotent and survives a concurrent creation', async () => {
    const { service, repo } = make();
    repo.findByPair.mockResolvedValueOnce(null as never);
    repo.createConversation.mockImplementationOnce(async () => {
      throw Object.assign(new Error('E11000'), { code: 'P2002' });
    });
    repo.findByPair.mockResolvedValueOnce(conv() as never);
    await expect(service.startConversation(traveler, { participantId: 'g1' })).resolves.toMatchObject({ id: 'c1' });
  });

  it('refuses agencies/staff, a missing counterpart and talking to yourself', async () => {
    const { service, users } = make();
    await expect(service.startConversation({ userId: 'a1', role: ROLES.AGENCY }, { participantId: 'g1' })).rejects.toMatchObject({ statusCode: 403 });
    users.assertActiveWithRole.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 404 }));
    await expect(service.startConversation(traveler, { participantId: 'ghost' })).rejects.toMatchObject({ statusCode: 404 });
    users.assertActiveWithRole.mockResolvedValueOnce({ id: 't1' } as never);
    await expect(service.startConversation(traveler, { participantId: 't1' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('messages', () => {
  it('persists, updates unread, pushes to both participants and notifies once for the first unread message', async () => {
    const { service, notifications } = make([conv()]);
    const publisher = vi.fn();
    service.setPublisher(publisher);

    const sent = await service.sendMessage('t1', 'c1', '  Hello guide!  ');
    expect(sent).toMatchObject({ text: 'Hello guide!', isMine: true, senderId: 't1' });
    expect(publisher).toHaveBeenCalledWith('g1', expect.objectContaining({ conversationId: 'c1', message: expect.objectContaining({ isMine: false }) }));
    expect(publisher).toHaveBeenCalledWith('t1', expect.objectContaining({ message: expect.objectContaining({ isMine: true }) }));
    expect(notifications.notify).toHaveBeenCalledTimes(1);

    await service.sendMessage('t1', 'c1', 'Second message');
    expect(notifications.notify).toHaveBeenCalledTimes(1); // recipient already has unread messages
  });

  it('strangers get 404 on every operation; empty text is rejected', async () => {
    const { service, repo } = make([conv()]);
    await expect(service.sendMessage('intruder', 'c1', 'hi')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.listMessages('intruder', 'c1', { limit: 30 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.markRead('intruder', 'c1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getCounterpartId('intruder', 'c1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.sendMessage('t1', 'missing', 'hi')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.sendMessage('t1', 'c1', '   ')).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it('a broken publisher never fails the send', async () => {
    const { service } = make([conv()]);
    service.setPublisher(() => {
      throw new Error('socket closed');
    });
    await expect(service.sendMessage('t1', 'c1', 'still stored')).resolves.toMatchObject({ text: 'still stored' });
  });

  it('marks read for the reader only and returns the counterpart id', async () => {
    const { service, repo } = make([conv({ unreadGuide: 2 })]);
    expect(await service.markRead('g1', 'c1')).toEqual({ unreadCount: 0 });
    expect(repo.markMessagesRead).toHaveBeenCalledWith('c1', 'g1');
    expect(repo.resetUnread).toHaveBeenCalledWith('c1', 'guide');
    expect(await service.getCounterpartId('g1', 'c1')).toBe('t1');
  });

  it('lists the inbox with the viewer\'s unread count and the other person\'s name', async () => {
    const { service } = make([conv({ unreadTraveler: 3 })]);
    const page = await service.listConversations(traveler, { page: 1, limit: 20 });
    expect(page.items[0]).toMatchObject({ unreadCount: 3, counterpart: { id: 'g1' } });
    await expect(service.listConversations({ userId: 'm1', role: ROLES.MODERATOR }, { page: 1, limit: 20 })).rejects.toMatchObject({ statusCode: 403 });
  });
});
