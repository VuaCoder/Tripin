import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../utils/app-error';
import type { DepartureFacts, TourListItemDto } from '../../tours';
import { CartsService } from '../carts.service';
import { CART_LIMITS } from '../carts.types';
import type { CartItemRecord } from '../carts.repository';

const NOW = new Date('2026-01-01T00:00:00Z');
const DEPARTURE_DATE = new Date('2026-12-01T00:00:00Z');

const record = (over: Partial<CartItemRecord> = {}): CartItemRecord =>
  ({
    id: 'c1',
    userId: 'u1',
    tourId: 't1',
    departureId: 'd1',
    participants: 2,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }) as CartItemRecord;

const facts = (over: Partial<DepartureFacts> = {}): DepartureFacts => ({
  tourId: 't1',
  departureId: 'd1',
  date: DEPARTURE_DATE,
  price: 1_000_000,
  remaining: 5,
  isOpen: true,
  bookable: true,
  ...over,
});

const card = (over: Partial<TourListItemDto> = {}): TourListItemDto =>
  ({ id: 't1', title: 'Ha Long Bay', destination: 'Quang Ninh', durationDays: 2, basePrice: 1_000_000, categoryIds: [], ratingAvg: 0, ratingCount: 0, ...over }) as TourListItemDto;

interface Options {
  exists?: boolean;
  count?: number;
  /** How `getBookableDeparture` answers. */
  bookable?: 'ok' | 'notFound' | 'unavailable';
  remaining?: number;
  /** Row returned by `findById` / `upsert`; `null` means "not found". */
  row?: Partial<CartItemRecord> | null;
  rows?: CartItemRecord[];
  factsMap?: Map<string, DepartureFacts>;
  cardsMap?: Map<string, TourListItemDto>;
  /** Simulate the line being deleted between the ownership read and the write. */
  updateMissing?: boolean;
}

function make(options: Options = {}) {
  const remaining = options.remaining ?? 5;
  const row = options.row === null ? null : record(options.row ?? {});

  const items = {
    upsert: vi.fn(async () => (options.row === null ? record() : record(options.row ?? {}))),
    findById: vi.fn(async () => row),
    exists: vi.fn(async () => options.exists ?? false),
    count: vi.fn(async () => options.count ?? 0),
    updateParticipants: vi.fn(async (_userId: string, _id: string, participants: number) => (options.updateMissing ? null : record({ participants }))),
    remove: vi.fn(async () => true),
    listByUser: vi.fn(async () => options.rows ?? []),
  };
  const tours = {
    getBookableDeparture: vi.fn(async () => {
      if (options.bookable === 'notFound') throw AppError.notFound('Tour not found');
      if (options.bookable === 'unavailable') throw AppError.conflict('This departure is closed or sold out', 'DEPARTURE_UNAVAILABLE');
      return {
        tourId: 't1',
        agencyId: 'a1',
        title: 'Ha Long Bay',
        durationDays: 2,
        departureId: 'd1',
        departureDate: DEPARTURE_DATE,
        unitPrice: 1_000_000,
        remaining,
      };
    }),
    getDepartureFacts: vi.fn(async () => options.factsMap ?? new Map([['t1:d1', facts({ remaining })]])),
  };
  const discovery = {
    getPublicCards: vi.fn(async () => options.cardsMap ?? new Map([['t1', card()]])),
  };
  return { service: new CartsService(items as never, tours as never, discovery as never), items, tours, discovery };
}

describe('add', () => {
  it('adds a bookable departure and returns the line with live money', async () => {
    const { service, items } = make();
    const result = await service.add('u1', { tourId: 't1', departureId: 'd1', participants: 2 });
    expect(result.created).toBe(true);
    expect(items.upsert).toHaveBeenCalledWith({ userId: 'u1', tourId: 't1', departureId: 'd1', participants: 2 });
    expect(result.item).toMatchObject({ available: true, unitPrice: 1_000_000, subtotal: 2_000_000 });
  });

  it('404s for an unknown / unpublished tour and 409 for an unbookable departure', async () => {
    await expect(make({ bookable: 'notFound' }).service.add('u1', { tourId: 't1', departureId: 'd1', participants: 1 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(make({ bookable: 'unavailable' }).service.add('u1', { tourId: 't1', departureId: 'd1', participants: 1 })).rejects.toMatchObject({ code: 'DEPARTURE_UNAVAILABLE' });
  });

  it('refuses a head-count above the remaining seats', async () => {
    await expect(make({ remaining: 2 }).service.add('u1', { tourId: 't1', departureId: 'd1', participants: 3 })).rejects.toMatchObject({ code: 'NOT_ENOUGH_SEATS' });
  });

  it('replaces the head-count when the departure is already in the cart (no second line, no limit check)', async () => {
    const { service, items } = make({ exists: true, count: CART_LIMITS.MAX_ITEMS });
    const result = await service.add('u1', { tourId: 't1', departureId: 'd1', participants: 4 });
    expect(result.created).toBe(false);
    expect(items.upsert).toHaveBeenCalledWith({ userId: 'u1', tourId: 't1', departureId: 'd1', participants: 4 });
    expect(items.count).not.toHaveBeenCalled();
  });

  it('stops at the size limit for a new departure', async () => {
    await expect(make({ count: CART_LIMITS.MAX_ITEMS }).service.add('u1', { tourId: 't1', departureId: 'd1', participants: 1 })).rejects.toMatchObject({ code: 'CART_FULL' });
  });
});

describe('updateParticipants', () => {
  it('updates one of my lines after re-checking live availability (never via a 404-throwing lookup)', async () => {
    const { service, items, tours } = make();
    const item = await service.updateParticipants('u1', 'c1', { participants: 3 });
    expect(tours.getDepartureFacts).toHaveBeenCalledWith([{ tourId: 't1', departureId: 'd1' }]);
    expect(tours.getBookableDeparture).not.toHaveBeenCalled();
    expect(items.updateParticipants).toHaveBeenCalledWith('u1', 'c1', 3);
    expect(item).toMatchObject({ participants: 3, available: true });
  });

  it('404s for a line that is not mine or does not exist', async () => {
    await expect(make({ row: null }).service.updateParticipants('u1', 'c1', { participants: 1 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(make({ row: { userId: 'other' } }).service.updateParticipants('u1', 'c1', { participants: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('404s when the line disappeared between the ownership read and the write', async () => {
    await expect(make({ updateMissing: true }).service.updateParticipants('u1', 'c1', { participants: 2 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('answers 409 (not 404) when the tour is no longer public or the departure is not bookable', async () => {
    await expect(make({ cardsMap: new Map() }).service.updateParticipants('u1', 'c1', { participants: 1 })).rejects.toMatchObject({
      statusCode: 409,
      code: 'DEPARTURE_UNAVAILABLE',
    });
    await expect(
      make({ factsMap: new Map([['t1:d1', facts({ bookable: false })]]) }).service.updateParticipants('u1', 'c1', { participants: 1 }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'DEPARTURE_UNAVAILABLE' });
  });

  it('refuses a head-count above the remaining seats', async () => {
    await expect(make({ remaining: 1 }).service.updateParticipants('u1', 'c1', { participants: 2 })).rejects.toMatchObject({ code: 'NOT_ENOUGH_SEATS' });
  });
});

describe('remove', () => {
  it('is scoped to the owner', async () => {
    const { service, items } = make();
    await service.remove('u1', 'c1');
    expect(items.remove).toHaveBeenCalledWith('u1', 'c1');
  });
});

describe('list', () => {
  it('returns an empty cart without querying tours', async () => {
    const { service, tours, discovery } = make({ rows: [] });
    const cart = await service.list('u1');
    expect(cart).toEqual({ items: [], totals: { itemCount: 0, participantCount: 0, availableCount: 0, unavailableCount: 0, subtotal: 0, currency: 'VND' } });
    expect(tours.getDepartureFacts).not.toHaveBeenCalled();
    expect(discovery.getPublicCards).not.toHaveBeenCalled();
  });

  it('flags a line whose tour is no longer public and keeps it out of the totals', async () => {
    const { service } = make({ rows: [record()], cardsMap: new Map() });
    const cart = await service.list('u1');
    expect(cart.items[0]).toMatchObject({ available: false, unavailableReason: 'TOUR_UNAVAILABLE' });
    expect(cart.items[0]!.tour).toBeUndefined();
    expect(cart.totals).toMatchObject({ itemCount: 1, availableCount: 0, unavailableCount: 1, subtotal: 0 });
  });

  it('flags a closed departure and a head-count that no longer fits', async () => {
    const closed = make({ rows: [record()], factsMap: new Map([['t1:d1', facts({ bookable: false })]]) });
    expect((await closed.service.list('u1')).items[0]).toMatchObject({ available: false, unavailableReason: 'DEPARTURE_UNAVAILABLE' });

    const tooMany = make({ rows: [record({ participants: 4 })], factsMap: new Map([['t1:d1', facts({ remaining: 2 })]]) });
    expect((await tooMany.service.list('u1')).items[0]).toMatchObject({ available: false, unavailableReason: 'NOT_ENOUGH_SEATS' });
  });

  it('computes the total from the bookable lines only, using live prices', async () => {
    const rows = [record({ id: 'c1', departureId: 'd1', participants: 2 }), record({ id: 'c2', departureId: 'd2', participants: 1 }), record({ id: 'c3', departureId: 'd3', participants: 5 })];
    const factsMap = new Map([
      ['t1:d1', facts({ price: 1_000_000, remaining: 5 })],
      ['t1:d2', facts({ departureId: 'd2', price: 500_000, remaining: 5 })],
      ['t1:d3', facts({ departureId: 'd3', bookable: false })],
    ]);
    const { service } = make({ rows, factsMap });
    const cart = await service.list('u1');
    expect(cart.totals).toEqual({ itemCount: 3, participantCount: 3, availableCount: 2, unavailableCount: 1, subtotal: 2_500_000, currency: 'VND' });
  });
});
