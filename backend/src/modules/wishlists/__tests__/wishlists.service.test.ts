import { describe, expect, it, vi } from 'vitest';
import { TOUR_STATUS } from '@travel-platform/constants';
import { WishlistsService } from '../wishlists.service';
import { WISHLIST_LIMITS } from '../wishlists.types';

function make(opts: { tourStatus?: string | null; exists?: boolean; count?: number; created?: boolean } = {}) {
  const items = {
    addIfAbsent: vi.fn(async () => opts.created ?? true),
    exists: vi.fn(async () => opts.exists ?? false),
    count: vi.fn(async () => opts.count ?? 0),
    remove: vi.fn(async () => true),
    list: vi.fn(),
  };
  const tours = {
    getTourFacts: vi.fn(async () =>
      opts.tourStatus === null ? null : { id: 't1', agencyId: 'a1', title: 'x', status: opts.tourStatus ?? TOUR_STATUS.APPROVED },
    ),
  };
  const discovery = { getPublicCards: vi.fn(async () => new Map()) };
  return { service: new WishlistsService(items as never, tours as never, discovery as never), items, tours, discovery };
}

describe('add', () => {
  it('saves a public tour for the user', async () => {
    const { service, items } = make();
    expect(await service.add('u1', 't1')).toEqual({ created: true });
    expect(items.addIfAbsent).toHaveBeenCalledWith('u1', 't1');
  });

  it('is idempotent: adding again succeeds with created=false', async () => {
    const { service } = make({ exists: true, created: false });
    expect(await service.add('u1', 't1')).toEqual({ created: false });
  });

  it.each([TOUR_STATUS.DRAFT, TOUR_STATUS.PENDING_REVIEW, TOUR_STATUS.SUSPENDED, TOUR_STATUS.ARCHIVED])(
    'refuses a %s tour with 404 (unpublished tours are not discoverable)',
    async (tourStatus) => {
      await expect(make({ tourStatus }).service.add('u1', 't1')).rejects.toMatchObject({ statusCode: 404 });
    },
  );

  it('404 for an unknown tour', async () => {
    await expect(make({ tourStatus: null }).service.add('u1', 'ghost')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('stops at the size limit but still allows re-adding an existing tour', async () => {
    await expect(make({ count: WISHLIST_LIMITS.MAX_ITEMS }).service.add('u1', 't1')).rejects.toMatchObject({ code: 'WISHLIST_FULL' });
    await expect(make({ count: WISHLIST_LIMITS.MAX_ITEMS, exists: true, created: false }).service.add('u1', 't1')).resolves.toEqual({ created: false });
  });
});

describe('remove', () => {
  it('is idempotent and scoped to the user', async () => {
    const { service, items } = make();
    await service.remove('u1', 't1');
    expect(items.remove).toHaveBeenCalledWith('u1', 't1');
  });
});

describe('list', () => {
  it('flags tours that are no longer public instead of hiding the entry', async () => {
    const { service, items, discovery } = make();
    items.list.mockResolvedValue({
      items: [
        { tourId: 'ta', createdAt: new Date('2026-01-02') },
        { tourId: 'tb', createdAt: new Date('2026-01-01') },
      ],
      total: 2,
    } as never);
    discovery.getPublicCards.mockResolvedValue(new Map([['ta', { id: 'ta', title: 'Tour A' }]]) as never);
    const page = await service.list('u1', { page: 1, limit: 20 });
    expect(items.list).toHaveBeenCalledWith('u1', { page: 1, limit: 20 });
    expect(page.items.map((i) => [i.tourId, i.available])).toEqual([['ta', true], ['tb', false]]);
    expect(page.items[1]!.tour).toBeUndefined();
    expect(page.meta.total).toBe(2);
  });
});
