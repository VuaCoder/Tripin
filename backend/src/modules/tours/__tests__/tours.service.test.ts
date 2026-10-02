import { describe, expect, it, vi } from 'vitest';
import { GUIDE_ASSIGNMENT_STATUS, ROLES, TOUR_STATUS } from '@travel-platform/constants';
import { ERROR_CODES } from '../../../utils/app-error';
import { ToursService } from '../tours.service';

const DAY = 24 * 60 * 60 * 1000;
const future = (days: number) => new Date(Date.now() + days * DAY);

type AnyTour = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function makeTour(overrides: AnyTour = {}): AnyTour {
  return {
    id: 't1',
    agencyId: 'a1',
    title: 'Ha Long 3D2N',
    status: TOUR_STATUS.DRAFT,
    durationDays: 3,
    categoryIds: ['c1'],
    itinerary: [],
    departures: [],
    __v: 0,
    ...overrides,
  };
}

const departure = (over: AnyTour = {}) => ({ _id: 'd1', date: future(10), capacity: 10, remaining: 10, isOpen: true, ...over });

function setup(tour: AnyTour | null) {
  const db: AnyTour | null = tour;
  const repo = {
    create: vi.fn(async (data: AnyTour) => ({ id: 'new', ...data })),
    insertMany: vi.fn(async (data: AnyTour[]) => data.map((d, i) => ({ id: `n${i}`, ...d }))),
    findById: vi.fn(async (id: string) => (db && db.id === id ? db : null)),
    updateIfStatus: vi.fn(async (_id: string, expected: string[], update: AnyTour) => {
      if (!db || !expected.includes(db.status)) return null;
      Object.assign(db, update.$set ?? {});
      if (update.$unset) for (const key of Object.keys(update.$unset)) delete db[key];
      return db;
    }),
    answerGuideAssignment: vi.fn(async (_id: string, _guide: string, update: AnyTour) => {
      if (!db?.guide || db.guide.status !== GUIDE_ASSIGNMENT_STATUS.PENDING) return null;
      db.guide = { ...db.guide, status: update.$set['guide.status'] };
      return db;
    }),
    listByAgency: vi.fn(),
    listByGuide: vi.fn(),
    listForModeration: vi.fn(),
    reserveSeats: vi.fn(async () => true),
    releaseSeats: vi.fn(async () => undefined),
    replaceDeparturesIfVersion: vi.fn(async (_id: string, _v: number, departures: AnyTour[]) => {
      if (!db) return null;
      db.departures = departures;
      return db;
    }),
  };
  const users = {
    assertActiveWithRole: vi.fn(async () => ({})),
    assertAgencyVerified: vi.fn(async () => undefined),
  };
  const categories = { assertActiveIds: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  const views = {
    manage: vi.fn(async (t: AnyTour) => t),
    manageMany: vi.fn(async (ts: AnyTour[]) => ts),
    guideItems: vi.fn(async (ts: AnyTour[]) => ts),
  };
  const notifications = { notify: vi.fn(async () => undefined) };
  const service = new ToursService(repo as never, users as never, categories as never, audit, views as never, notifications);
  return { service, repo, users, categories, audit, notifications, db };
}

const content = { title: 'Ha Long 3D2N', destination: 'Quang Ninh', durationDays: 3, basePrice: 3_000_000, categoryIds: ['c1'] };

describe('create / import', () => {
  it('creates a DRAFT after validating categories', async () => {
    const { service, categories, repo } = setup(null);
    await service.createTour('a1', content);
    expect(categories.assertActiveIds).toHaveBeenCalledWith(['c1']);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'a1', title: 'Ha Long 3D2N' }));
  });

  it('imports a batch in one insert and never sets a status itself (DRAFT by default)', async () => {
    const { service, repo } = setup(null);
    const result = await service.importTours('a1', [content, { ...content, title: 'Sapa 2D1N' }]);
    expect(result.created).toBe(2);
    expect(repo.insertMany).toHaveBeenCalledOnce();
    expect(repo.insertMany.mock.calls[0]![0].every((t: AnyTour) => t.status === undefined)).toBe(true);
  });
});

describe('ownership', () => {
  it('returns 404 (not 403) for another agency\'s tour', async () => {
    const { service } = setup(makeTour({ agencyId: 'someone-else' }));
    await expect(service.getOwn('a1', 't1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.updateTour('a1', 't1', { title: 'Hacked title' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.deleteTour('a1', 't1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('hides archived tours from their owner', async () => {
    const { service } = setup(makeTour({ status: TOUR_STATUS.ARCHIVED }));
    await expect(service.getOwn('a1', 't1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('edit rules', () => {
  it('locks a tour that is under review', async () => {
    const { service } = setup(makeTour({ status: TOUR_STATUS.PENDING_REVIEW }));
    await expect(service.updateTour('a1', 't1', { title: 'New title here' })).rejects.toMatchObject({ code: 'TOUR_LOCKED' });
  });

  it('sends an APPROVED tour back to review when its content changes', async () => {
    const { service, db } = setup(makeTour({ status: TOUR_STATUS.APPROVED }));
    await service.updateTour('a1', 't1', { title: 'Better title here' });
    expect(db!.status).toBe(TOUR_STATUS.PENDING_REVIEW);
  });

  it('keeps a DRAFT a DRAFT', async () => {
    const { service, db } = setup(makeTour());
    await service.updateTour('a1', 't1', { summary: 'short' });
    expect(db!.status).toBe(TOUR_STATUS.DRAFT);
  });

  it('refuses to shorten the tour below the configured itinerary', async () => {
    const { service } = setup(makeTour({ itinerary: [{ day: 3, title: 'Day 3' }] }));
    await expect(service.updateTour('a1', 't1', { durationDays: 2 })).rejects.toMatchObject({ code: 'ITINERARY_EXCEEDS_DURATION' });
  });

  it('rejects itinerary days beyond durationDays', async () => {
    const { service } = setup(makeTour());
    await expect(service.setItinerary('a1', 't1', [{ day: 4, title: 'Day 4' }])).rejects.toMatchObject({ statusCode: 400 });
  });

  it('stores the itinerary sorted by day', async () => {
    const { service, db } = setup(makeTour());
    await service.setItinerary('a1', 't1', [
      { day: 2, title: 'Second' },
      { day: 1, title: 'First' },
    ]);
    expect(db!.itinerary.map((d: AnyTour) => d.day)).toEqual([1, 2]);
  });
});

describe('delete', () => {
  it('archives a tour without booked upcoming departures', async () => {
    const { service, db } = setup(makeTour({ departures: [departure()] }));
    await service.deleteTour('a1', 't1');
    expect(db!.status).toBe(TOUR_STATUS.ARCHIVED);
  });

  it('refuses while a future departure has booked seats', async () => {
    const { service } = setup(makeTour({ departures: [departure({ remaining: 7 })] }));
    await expect(service.deleteTour('a1', 't1')).rejects.toMatchObject({ code: 'TOUR_HAS_BOOKINGS' });
  });

  it('refuses to delete a tour that is under review', async () => {
    const { service } = setup(makeTour({ status: TOUR_STATUS.PENDING_REVIEW }));
    await expect(service.deleteTour('a1', 't1')).rejects.toMatchObject({ code: ERROR_CODES.INVALID_STATE_TRANSITION });
  });
});

describe('availability', () => {
  const input = (over: AnyTour = {}) => ({ id: 'd1', date: future(10), capacity: 10, isOpen: true, ...over });

  it('adds a new departure with all seats free', async () => {
    const { service, repo } = setup(makeTour());
    await service.setAvailability('a1', 't1', [{ date: future(5), capacity: 20, isOpen: true }]);
    expect(repo.replaceDeparturesIfVersion.mock.calls[0]![2][0]).toMatchObject({ capacity: 20, remaining: 20 });
  });

  it('rejects new departures in the past', async () => {
    const { service } = setup(makeTour());
    await expect(service.setAvailability('a1', 't1', [{ date: future(-1), capacity: 5, isOpen: true }])).rejects.toMatchObject({ statusCode: 400 });
  });

  it('keeps sold seats when capacity changes (remaining = capacity - booked)', async () => {
    const d = departure({ capacity: 10, remaining: 4 });
    const { service, repo } = setup(makeTour({ departures: [d] }));
    await service.setAvailability('a1', 't1', [input({ date: d.date, capacity: 12 })]);
    expect(repo.replaceDeparturesIfVersion.mock.calls[0]![2][0]).toMatchObject({ capacity: 12, remaining: 6 });
  });

  it('refuses capacity below the seats already sold', async () => {
    const d = departure({ capacity: 10, remaining: 4 });
    const { service } = setup(makeTour({ departures: [d] }));
    await expect(service.setAvailability('a1', 't1', [input({ date: d.date, capacity: 5 })])).rejects.toMatchObject({ code: 'CAPACITY_BELOW_BOOKED' });
  });

  it('refuses to move or remove a departure that has booked seats', async () => {
    const d = departure({ remaining: 9 });
    const { service } = setup(makeTour({ departures: [d] }));
    await expect(service.setAvailability('a1', 't1', [input({ date: future(20) })])).rejects.toMatchObject({ code: 'DEPARTURE_HAS_BOOKINGS' });
    await expect(service.setAvailability('a1', 't1', [])).rejects.toMatchObject({ code: 'DEPARTURE_HAS_BOOKINGS' });
  });

  it('allows removing an untouched departure', async () => {
    const { service, db } = setup(makeTour({ departures: [departure()] }));
    await service.setAvailability('a1', 't1', []);
    expect(db!.departures).toEqual([]);
  });

  it('reports a concurrent seat change as 409 instead of overwriting', async () => {
    const { service, repo } = setup(makeTour({ departures: [departure()] }));
    repo.replaceDeparturesIfVersion.mockResolvedValueOnce(null as never);
    await expect(service.setAvailability('a1', 't1', [])).rejects.toMatchObject({ code: 'CONCURRENT_UPDATE' });
  });

  it('rejects unknown departure ids', async () => {
    const { service } = setup(makeTour());
    await expect(service.setAvailability('a1', 't1', [input({ id: 'ghost' })])).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('submit for review', () => {
  const ready = () => makeTour({ departures: [departure()] });

  it('moves DRAFT to PENDING_REVIEW for a verified agency', async () => {
    const { service, db, users } = setup(ready());
    await service.submitForReview('a1', 't1');
    expect(users.assertAgencyVerified).toHaveBeenCalledWith('a1');
    expect(db!.status).toBe(TOUR_STATUS.PENDING_REVIEW);
  });

  it('requires a verified agency', async () => {
    const { service, users } = setup(ready());
    users.assertAgencyVerified.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 403, code: 'AGENCY_NOT_VERIFIED' }));
    await expect(service.submitForReview('a1', 't1')).rejects.toMatchObject({ code: 'AGENCY_NOT_VERIFIED' });
  });

  it('requires an open future departure', async () => {
    const { service } = setup(makeTour({ departures: [departure({ date: future(-3) })] }));
    await expect(service.submitForReview('a1', 't1')).rejects.toMatchObject({ code: 'NO_OPEN_DEPARTURE' });
  });

  it('cannot be submitted twice', async () => {
    const { service } = setup(ready());
    await service.submitForReview('a1', 't1');
    await expect(service.submitForReview('a1', 't1')).rejects.toMatchObject({ code: ERROR_CODES.INVALID_STATE_TRANSITION });
  });
});

describe('moderation', () => {
  const moderator = { userId: 'm1', role: ROLES.MODERATOR } as const;

  it('approves only a PENDING_REVIEW tour and audits it', async () => {
    const { service, db, audit, notifications } = setup(makeTour({ status: TOUR_STATUS.PENDING_REVIEW }));
    await service.decideReview(moderator, 't1', { approve: true });
    expect(db!.status).toBe(TOUR_STATUS.APPROVED);
    expect(notifications.notify).toHaveBeenCalledWith('a1', expect.objectContaining({ type: 'TOUR_APPROVED' }), { email: true });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'tour.validated' }));
    await expect(service.decideReview(moderator, 't1', { approve: true })).rejects.toMatchObject({ code: ERROR_CODES.INVALID_STATE_TRANSITION });
  });

  it('requires a reason to reject and stores it', async () => {
    const { service, db } = setup(makeTour({ status: TOUR_STATUS.PENDING_REVIEW }));
    await expect(service.decideReview(moderator, 't1', { approve: false })).rejects.toMatchObject({ statusCode: 400 });
    await service.decideReview(moderator, 't1', { approve: false, reason: 'Photos missing' });
    expect(db!.status).toBe(TOUR_STATUS.REJECTED);
    expect(db!.statusReason).toBe('Photos missing');
  });

  it('suspends only APPROVED tours', async () => {
    const approved = setup(makeTour({ status: TOUR_STATUS.APPROVED }));
    await approved.service.suspendTour(moderator, 't1', 'Complaints');
    expect(approved.db!.status).toBe(TOUR_STATUS.SUSPENDED);
    const draft = setup(makeTour());
    await expect(draft.service.suspendTour(moderator, 't1', 'x')).rejects.toMatchObject({ code: ERROR_CODES.INVALID_STATE_TRANSITION });
  });

  it('lets the agency resubmit a rejected tour', async () => {
    const { service, db } = setup(makeTour({ status: TOUR_STATUS.REJECTED, departures: [departure()] }));
    await service.submitForReview('a1', 't1');
    expect(db!.status).toBe(TOUR_STATUS.PENDING_REVIEW);
  });
});

describe('guide assignment', () => {
  it('assigns a PENDING guide after checking the guide is an active TOUR_GUIDE', async () => {
    const { service, users, db, notifications } = setup(makeTour());
    await service.assignGuide('a1', 't1', { guideId: 'g1', feePerBooking: 200_000 });
    expect(notifications.notify).toHaveBeenCalledWith('g1', expect.objectContaining({ type: 'GUIDE_ASSIGNED' }));
    expect(users.assertActiveWithRole).toHaveBeenCalledWith('g1', ROLES.TOUR_GUIDE);
    expect(db!.guide).toMatchObject({ guideId: 'g1', feePerBooking: 200_000, status: GUIDE_ASSIGNMENT_STATUS.PENDING });
  });

  it('removes the assignment with guideId null', async () => {
    const { service, db } = setup(makeTour({ guide: { guideId: 'g1', feePerBooking: 1, status: 'PENDING' } }));
    await service.assignGuide('a1', 't1', { guideId: null });
    expect(db!.guide).toBeUndefined();
  });

  it('lets only the assigned guide answer, once', async () => {
    const guide = { guideId: { toString: () => 'g1' }, feePerBooking: 1, status: GUIDE_ASSIGNMENT_STATUS.PENDING };
    const { service } = setup(makeTour({ guide }));
    await expect(service.answerAssignment('g2', 't1', { accept: true })).rejects.toMatchObject({ statusCode: 404 });
    await service.answerAssignment('g1', 't1', { accept: true });
    // second answer: state moved on, transition refused
    const answered = setup(makeTour({ guide: { ...guide, status: GUIDE_ASSIGNMENT_STATUS.ACCEPTED } }));
    await expect(answered.service.answerAssignment('g1', 't1', { accept: false })).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_STATE_TRANSITION,
    });
  });
});

describe('inventory for bookings', () => {
  it('describes a bookable departure with the effective price', async () => {
    const d = departure({ priceOverride: 2_500_000 });
    const { service } = setup(makeTour({ status: TOUR_STATUS.APPROVED, basePrice: 3_000_000, departures: [d] }));
    const result = await service.getBookableDeparture('t1', 'd1');
    expect(result).toMatchObject({ tourId: 't1', agencyId: 'a1', unitPrice: 2_500_000, remaining: 10 });
  });

  it('refuses unpublished tours, closed and sold-out departures', async () => {
    const draft = setup(makeTour({ departures: [departure()] }));
    await expect(draft.service.getBookableDeparture('t1', 'd1')).rejects.toMatchObject({ statusCode: 404 });
    const closed = setup(makeTour({ status: TOUR_STATUS.APPROVED, departures: [departure({ isOpen: false })] }));
    await expect(closed.service.getBookableDeparture('t1', 'd1')).rejects.toMatchObject({ code: 'DEPARTURE_UNAVAILABLE' });
    const soldOut = setup(makeTour({ status: TOUR_STATUS.APPROVED, departures: [departure({ remaining: 0 })] }));
    await expect(soldOut.service.getBookableDeparture('t1', 'd1')).rejects.toMatchObject({ code: 'DEPARTURE_UNAVAILABLE' });
  });

  it('turns a failed atomic reservation into NOT_ENOUGH_SEATS', async () => {
    const { service, repo } = setup(makeTour());
    repo.reserveSeats.mockResolvedValueOnce(false as never);
    await expect(service.reserveSeats('t1', 'd1', 3)).rejects.toMatchObject({ statusCode: 409, code: 'NOT_ENOUGH_SEATS' });
  });
});
