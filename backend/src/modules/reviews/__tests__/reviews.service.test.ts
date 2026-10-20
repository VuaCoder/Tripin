import { describe, expect, it, vi } from 'vitest';
import { BOOKING_STATUS, ROLES } from '@travel-platform/constants';
import { maskName } from '../reviews.mapper';
import { ReviewsService } from '../reviews.service';
import { verifyImageUpload, createImageUploadSignature } from '../../../integrations/cloudinary';
vi.mock('../../../integrations/cloudinary', async importOriginal => ({
  ...await importOriginal<typeof import('../../../integrations/cloudinary')>(),
  verifyImageUpload: vi.fn(async (_purpose, _owner, publicId) => ({ publicId, secureUrl: 'https://res.cloudinary.com/test/image/upload/trip.jpg' })),
  createImageUploadSignature: vi.fn(() => ({ params: { overwrite: 'false' } })),
}));

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const facts = (over: R = {}) => ({
  id: 'b1',
  bookingCode: 'TRP-AAAA2222',
  status: BOOKING_STATUS.COMPLETED,
  travelerId: 'u1',
  agencyId: 'a1',
  tourId: 't1',
  tourTitle: 'Ha Long',
  ...over,
});

function make(opts: { booking?: R | null; seed?: R[]; stats?: { avg: number; count: number } } = {}) {
  const db = [...(opts.seed ?? [])];
  const repo = {
    create: vi.fn(async (data: R) => {
      const doc = { id: `r${db.length + 1}`, status: 'VISIBLE', createdAt: new Date(), ...data };
      db.push(doc);
      return doc;
    }),
    findById: vi.fn(async (id: string) => db.find((r) => r.id === id) ?? null),
    findByBookingId: vi.fn(async (bookingId: string) => db.find((r) => String(r.bookingId) === bookingId) ?? null),
    transition: vi.fn(async (id: string, expected: string, update: R) => {
      const doc = db.find((r) => r.id === id);
      if (!doc || doc.status !== expected) return null;
      Object.assign(doc, update);
      return doc;
    }),
    listPublic: vi.fn(async () => ({ items: db, total: db.length })),
    listByTraveler: vi.fn(async () => ({ items: db, total: db.length })),
    listForModeration: vi.fn(async () => ({ items: db, total: db.length })),
    visibleStats: vi.fn(async () => opts.stats ?? { avg: 4.666666, count: 3 }),
  };
  const bookings = { getFacts: vi.fn(async () => (opts.booking === undefined ? facts() : opts.booking)) };
  const tours = { updateRatingStats: vi.fn(async () => undefined) };
  const users = {
    getSummaries: vi.fn(
      async () =>
        new Map([
          ['u1', { id: 'u1', fullName: 'Nguyen Van An', avatarUrl: 'http://x/a.png' }],
          ['a1', { id: 'a1', fullName: 'Tran Thi B', companyName: 'Saigon Travel' }],
        ]),
    ),
  };
  const notifications = { notify: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  return { service: new ReviewsService(repo as never, bookings as never, tours as never, users as never, notifications, audit), repo, bookings, tours, notifications, audit, db };
}

const input = { bookingId: 'b1', rating: 5, comment: 'Wonderful trip, great guide!' };

describe('createReview', () => {
  it('checks image ownership before verification and persists only verified storage URLs', async () => {
    const id = 'tripin/reviews/u1/b1/11111111-1111-4111-8111-111111111111';
    const { service, repo } = make();
    const dto = await service.createReview('u1', { ...input, imagePublicIds: [id] });
    expect(verifyImageUpload).toHaveBeenCalledWith('reviewImage', id.slice('tripin/reviews/'.length), id);
    expect(dto.images).toEqual(['https://res.cloudinary.com/test/image/upload/trip.jpg']);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ images: dto.images }));
    await expect(service.createReview('u1', { ...input, bookingId: 'b2', imagePublicIds: ['tripin/reviews/other/b2/11111111-1111-4111-8111-111111111111'] })).rejects.toBeDefined();
  });

  it('refuses foreign assets, duplicate assets and more than six images', async () => {
    const id = 'tripin/reviews/other/b1/11111111-1111-4111-8111-111111111111';
    await expect(make().service.createReview('u1', { ...input, imagePublicIds: [id] })).rejects.toMatchObject({ statusCode: 403 });
    await expect(make().service.createReview('u1', { ...input, imagePublicIds: [id, id] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(make().service.createReview('u1', { ...input, imagePublicIds: Array.from({ length: 7 }, (_, i) => String(i)) })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('only issues image signatures for an owned, completed, unreviewed booking', async () => {
    await make().service.createImageSignature('u1', 'b1');
    expect(createImageUploadSignature).toHaveBeenCalledWith('reviewImage', expect.stringMatching(/^u1\/b1\//));
    await expect(make({ booking: facts({ travelerId: 'other' }) }).service.createImageSignature('u1', 'b1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(make({ booking: facts({ status: 'PENDING' }) }).service.createImageSignature('u1', 'b1')).rejects.toMatchObject({ code: 'BOOKING_NOT_COMPLETED' });
  });
  it('reviews a completed booking, takes tour/agency from the booking and refreshes the tour rating', async () => {
    const { service, repo, tours, notifications } = make();
    const dto = await service.createReview('u1', { ...input });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'b1', tourId: 't1', agencyId: 'a1', travelerId: 'u1', rating: 5 }));
    expect(dto).toMatchObject({ rating: 5, status: 'VISIBLE', tourTitle: 'Ha Long' });
    expect(tours.updateRatingStats).toHaveBeenCalledWith('t1', 4.67, 3);
    expect(notifications.notify).toHaveBeenCalledWith('a1', expect.objectContaining({ type: 'REVIEW_RECEIVED' }));
  });

  it('refuses someone else\'s booking with 404 and an unknown booking too', async () => {
    await expect(make({ booking: facts({ travelerId: 'other' }) }).service.createReview('u1', input)).rejects.toMatchObject({ statusCode: 404 });
    await expect(make({ booking: null }).service.createReview('u1', input)).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each([BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED])('refuses a %s booking', async (status) => {
    await expect(make({ booking: facts({ status }) }).service.createReview('u1', input)).rejects.toMatchObject({ code: 'BOOKING_NOT_COMPLETED' });
  });

  it('allows one review per booking, also under a race on the unique index', async () => {
    const { service, repo } = make({ seed: [{ id: 'r1', bookingId: 'b1' }] });
    await expect(service.createReview('u1', input)).rejects.toMatchObject({ code: 'REVIEW_EXISTS' });
    const raced = make();
    raced.repo.create.mockRejectedValueOnce(Object.assign(new Error('E11000'), { code: 'P2002' }) as never);
    await expect(raced.service.createReview('u1', input)).rejects.toMatchObject({ code: 'REVIEW_EXISTS' });
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('public list', () => {
  it('masks the author name and exposes no traveler id', async () => {
    const { service } = make({ seed: [{ id: 'r1', rating: 5, comment: 'Great', tourId: 't1', travelerId: 'u1', createdAt: new Date('2026-01-01') }] });
    const page = await service.listPublic({ page: 1, limit: 20, tourId: 't1', sort: 'newest' });
    expect(page.items[0]!.author).toEqual({ name: 'Nguyen A.', avatarUrl: 'http://x/a.png' });
    expect(JSON.stringify(page.items[0])).not.toContain('u1');
  });

  it('maskName handles odd names', () => {
    expect(maskName(undefined)).toBe('Traveler');
    expect(maskName('  ')).toBe('Traveler');
    expect(maskName('Madonna')).toBe('Madonna');
    expect(maskName('Tran thi bich ngoc')).toBe('Tran N.');
  });
});

describe('moderation', () => {
  const moderator = { userId: 'm1', role: ROLES.MODERATOR } as const;
  const stored = (over: R = {}) => ({ id: 'r1', bookingId: 'b1', tourId: 't1', tourTitle: 'Ha Long', travelerId: 'u1', agencyId: 'a1', rating: 1, comment: 'bad', status: 'VISIBLE', createdAt: new Date(), ...over });

  it('hides with a reason, recomputes the rating, audits and tells the author', async () => {
    const { service, db, tours, audit, notifications } = make({ seed: [stored()], stats: { avg: 4.5, count: 2 } });
    const dto = await service.moderate(moderator, 'r1', { hide: true, reason: 'Abusive language' });
    expect(db[0]).toMatchObject({ status: 'HIDDEN', hiddenReason: 'Abusive language', moderatedById: 'm1' });
    expect(dto.status).toBe('HIDDEN');
    expect(tours.updateRatingStats).toHaveBeenCalledWith('t1', 4.5, 2);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'review.moderated' }));
    expect(notifications.notify).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'REVIEW_MODERATED' }));
  });

  it('requires a reason to hide', async () => {
    await expect(make({ seed: [stored()] }).service.moderate(moderator, 'r1', { hide: true })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('restores a hidden review and clears the reason; cannot hide twice', async () => {
    const { service, db } = make({ seed: [stored({ status: 'HIDDEN', hiddenReason: 'x' })] });
    await service.moderate(moderator, 'r1', { hide: false });
    expect(db[0]!.status).toBe('VISIBLE');
    expect(db[0]!.hiddenReason).toBeNull();
    await service.moderate(moderator, 'r1', { hide: true, reason: 'again please' });
    await expect(service.moderate(moderator, 'r1', { hide: true, reason: 'twice' })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('404 for an unknown review', async () => {
    await expect(make().service.moderate(moderator, 'nope', { hide: false })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('names the author and the agency in the queue and after a decision, keeping the ids for the actions', async () => {
    const { service } = make({ seed: [stored()] });
    const page = await service.listForModeration({ page: 1, limit: 10 });
    expect(page.items[0]).toMatchObject({ travelerName: 'Nguyen Van An', agencyName: 'Saigon Travel', travelerId: 'u1' });
    expect(await service.moderate(moderator, 'r1', { hide: true, reason: 'Abusive language' })).toMatchObject({ travelerName: 'Nguyen Van An' });
  });
});
