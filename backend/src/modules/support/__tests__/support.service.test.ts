import { describe, expect, it, vi } from 'vitest';
import { ROLES } from '@travel-platform/constants';
import { SupportService } from '../support.service';
import { SUPPORT_LIMITS } from '../support.types';

type T = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function ticket(over: T = {}): T {
  return {
    id: 'k1',
    userId: 'u1',
    subject: 'Refund question',
    category: 'PAYMENT',
    status: 'OPEN',
    messages: [{ authorId: 'u1', authorKind: 'USER', text: 'Where is my refund?', createdAt: new Date() }],
    messageCount: 1,
    lastMessageAt: new Date(),
    createdAt: new Date(),
    ...over,
  };
}

function make(seed: T[] = []) {
  const db = [...seed];
  const repo = {
    create: vi.fn(async (data: T) => {
      const { message, ...rest } = data as T;
      const doc = ticket({ ...rest, id: `k${db.length + 1}`, status: 'OPEN', messageCount: 1, messages: [{ ...message, createdAt: new Date() }] });
      db.push(doc);
      return doc;
    }),
    findById: vi.fn(async (id: string) => db.find((t) => t.id === id) ?? null),
    appendMessage: vi.fn(async (id: string, expected: string[], message: T, next: string, extra: T = {}) => {
      const doc = db.find((t) => t.id === id);
      if (!doc || !expected.includes(doc.status) || doc.messageCount >= SUPPORT_LIMITS.MAX_MESSAGES_PER_TICKET) return null;
      doc.messages.push({ ...message, createdAt: new Date() });
      doc.messageCount += 1;
      doc.status = next;
      Object.assign(doc, extra);
      return doc;
    }),
    transition: vi.fn(async (id: string, expected: string[], next: string) => {
      const doc = db.find((t) => t.id === id);
      if (!doc || !expected.includes(doc.status)) return null;
      doc.status = next;
      return doc;
    }),
    listByUser: vi.fn(async () => ({ items: db, total: db.length })),
    listForModeration: vi.fn(async () => ({ items: db, total: db.length })),
  };
  const bookings = { getFacts: vi.fn(async (id: string) => (id === 'ghost' ? null : { id, travelerId: 'u1' })) };
  const notifications = { notify: vi.fn(async () => undefined) };
  return { service: new SupportService(repo as never, bookings as never, notifications), repo, bookings, notifications, db };
}

const moderator = { userId: 'm1', role: ROLES.MODERATOR } as const;
const input = { subject: 'Refund question', category: 'PAYMENT', message: 'Where is my refund please?' } as const;

describe('createTicket', () => {
  it('opens a ticket with the first message from the user', async () => {
    const { service, repo } = make();
    const dto = await service.createTicket('u1', input);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', message: expect.objectContaining({ text: 'Where is my refund please?' }) }));
    expect(dto).toMatchObject({ status: 'OPEN', messageCount: 1, messages: [{ author: 'YOU', text: 'Where is my refund please?' }] });
  });

  it('only accepts the user\'s own booking as context', async () => {
    const { service, bookings } = make();
    await expect(service.createTicket('u1', { ...input, bookingId: 'ghost' })).rejects.toMatchObject({ statusCode: 404 });
    bookings.getFacts.mockResolvedValueOnce({ id: 'b2', travelerId: 'other' } as never);
    await expect(service.createTicket('u1', { ...input, bookingId: 'b2' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('owner access', () => {
  it('hides other people\'s tickets behind 404 for every operation', async () => {
    const { service } = make([ticket({ userId: 'other' })]);
    await expect(service.getMine('u1', 'k1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.replyAsOwner('u1', 'k1', 'hello?')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.closeMine('u1', 'k1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('shows staff replies as SUPPORT without revealing which moderator wrote them', async () => {
    const { service } = make([ticket({ messages: [{ authorId: 'u1', authorKind: 'USER', text: 'q', createdAt: new Date() }, { authorId: 'm1', authorKind: 'STAFF', text: 'a', createdAt: new Date() }], messageCount: 2 })]);
    const dto = await service.getMine('u1', 'k1');
    expect(dto.messages.map((m) => m.author)).toEqual(['YOU', 'SUPPORT']);
    expect(JSON.stringify(dto)).not.toContain('m1');
  });

  it('a reply on a RESOLVED ticket reopens it; on a CLOSED ticket it is refused', async () => {
    const resolved = make([ticket({ status: 'RESOLVED' })]);
    expect((await resolved.service.replyAsOwner('u1', 'k1', 'still broken')).status).toBe('IN_PROGRESS');
    const closed = make([ticket({ status: 'CLOSED' })]);
    await expect(closed.service.replyAsOwner('u1', 'k1', 'hello again')).rejects.toMatchObject({ code: 'TICKET_CLOSED' });
  });

  it('keeps OPEN / IN_PROGRESS tickets in their status when the user adds a message', async () => {
    const { service } = make([ticket({ status: 'IN_PROGRESS' })]);
    expect((await service.replyAsOwner('u1', 'k1', 'one more detail')).status).toBe('IN_PROGRESS');
  });

  it('reports a full ticket explicitly', async () => {
    const { service } = make([ticket({ messageCount: SUPPORT_LIMITS.MAX_MESSAGES_PER_TICKET })]);
    await expect(service.replyAsOwner('u1', 'k1', 'one more?')).rejects.toMatchObject({ code: 'TICKET_FULL' });
  });

  it('closing is final', async () => {
    const { service } = make([ticket()]);
    expect((await service.closeMine('u1', 'k1')).status).toBe('CLOSED');
    await expect(service.closeMine('u1', 'k1')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });
});

describe('staff handling', () => {
  it('first reply moves OPEN -> IN_PROGRESS, assigns the moderator and notifies the user (app + email)', async () => {
    const { service, db, notifications } = make([ticket()]);
    const dto = await service.replyAsStaff(moderator, 'k1', { text: 'We are checking your refund.' });
    expect(dto).toMatchObject({ status: 'IN_PROGRESS', assignedTo: 'm1', userId: 'u1' });
    expect(db[0]!.messages.at(-1)).toMatchObject({ authorKind: 'STAFF', authorId: 'm1' });
    expect(notifications.notify).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'SUPPORT_REPLIED' }), { email: true });
  });

  it('keeps the original assignee on later replies and can resolve in the same step', async () => {
    const { service, db } = make([ticket({ status: 'IN_PROGRESS', assignedToId: 'm0' })]);
    const dto = await service.replyAsStaff(moderator, 'k1', { text: 'Refund sent.', resolve: true });
    expect(dto.status).toBe('RESOLVED');
    expect(db[0]!.assignedToId).toBe('m0');
  });

  it('cannot reply on resolved or closed tickets, nor on unknown ones', async () => {
    for (const status of ['RESOLVED', 'CLOSED']) {
      const { service } = make([ticket({ status })]);
      await expect(service.replyAsStaff(moderator, 'k1', { text: 'late answer' })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    }
    await expect(make().service.replyAsStaff(moderator, 'nope', { text: 'hello?' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('setStatus enforces the state machine', async () => {
    const { service } = make([ticket()]);
    expect((await service.setStatus(moderator, 'k1', 'IN_PROGRESS')).status).toBe('IN_PROGRESS');
    expect((await service.setStatus(moderator, 'k1', 'RESOLVED')).status).toBe('RESOLVED');
    await expect(service.setStatus(moderator, 'k1', 'IN_PROGRESS')).resolves.toMatchObject({ status: 'IN_PROGRESS' }); // RESOLVED -> IN_PROGRESS is allowed (reopen)
    const closed = make([ticket({ status: 'CLOSED' })]);
    await expect(closed.service.setStatus(moderator, 'k1', 'RESOLVED')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });
});
