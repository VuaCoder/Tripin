import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, ROLES, TOUR_STATUS } from '@travel-platform/constants';
import { GUEST_ACTOR, type UserActor } from '../../../types/actor';
import { ToursDiscoveryService } from '../tours-discovery.service';

const tour = (status: string, agencyId = 'a1') => ({ id: 't1', status, agencyId });

function make(found: ReturnType<typeof tour> | null) {
  const repo = { findById: vi.fn(async () => found), searchPublic: vi.fn(async () => ({ items: [found], total: 41 })) };
  const views = {
    publicDetail: vi.fn(async () => 'PUBLIC'),
    manage: vi.fn(async () => 'MANAGE'),
    listItems: vi.fn(async (items: unknown[]) => items),
  };
  return { service: new ToursDiscoveryService(repo as never, views as never), repo, views };
}

const user = (over: Partial<UserActor> = {}): UserActor => ({
  kind: 'user',
  userId: 'u9',
  email: 'x@y.z',
  role: ROLES.TRAVELER,
  permissions: [],
  ...over,
});

describe('ToursDiscoveryService.getDetail', () => {
  it('shows APPROVED tours to guests with the public view', async () => {
    expect(await make(tour(TOUR_STATUS.APPROVED)).service.getDetail('t1', GUEST_ACTOR)).toBe('PUBLIC');
  });

  it.each([TOUR_STATUS.DRAFT, TOUR_STATUS.PENDING_REVIEW, TOUR_STATUS.REJECTED, TOUR_STATUS.SUSPENDED, TOUR_STATUS.ARCHIVED])(
    'hides %s tours from guests and other users with 404',
    async (status) => {
      const { service } = make(tour(status));
      await expect(service.getDetail('t1', GUEST_ACTOR)).rejects.toMatchObject({ statusCode: 404 });
      await expect(service.getDetail('t1', user())).rejects.toMatchObject({ statusCode: 404 });
    },
  );

  it('shows the owner their own non-archived tour, with the management view', async () => {
    const owner = user({ userId: 'a1', role: ROLES.AGENCY });
    expect(await make(tour(TOUR_STATUS.DRAFT)).service.getDetail('t1', owner)).toBe('MANAGE');
    await expect(make(tour(TOUR_STATUS.ARCHIVED)).service.getDetail('t1', owner)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('does not show another agency\'s draft', async () => {
    const other = user({ userId: 'a2', role: ROLES.AGENCY });
    await expect(make(tour(TOUR_STATUS.DRAFT)).service.getDetail('t1', other)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lets staff with tour:list-all see any status', async () => {
    const staff = user({ role: ROLES.MODERATOR, permissions: [PERMISSIONS.TOUR_LIST_ALL] });
    expect(await make(tour(TOUR_STATUS.SUSPENDED)).service.getDetail('t1', staff)).toBe('MANAGE');
  });

  it('404 for a tour that does not exist', async () => {
    await expect(make(null).service.getDetail('nope', GUEST_ACTOR)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('ToursDiscoveryService.search', () => {
  it('returns pagination meta from the repository total', async () => {
    const { service } = make(tour(TOUR_STATUS.APPROVED));
    const page = await service.search({ page: 3, limit: 20, sort: 'newest' });
    expect(page.meta).toEqual({ page: 3, limit: 20, total: 41, totalPages: 3 });
  });
});
