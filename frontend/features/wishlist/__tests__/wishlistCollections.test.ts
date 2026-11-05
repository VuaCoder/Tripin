import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWishlistCollections,
  createWishlistCollection,
  deleteWishlistCollection,
  addTourToCollection,
  addTourToLatestCollection,
  getLatestWishlistCollection,
  removeTourFromAllCollections,
} from '../utils/wishlistCollections';
import {
  formatMilestoneDate,
  groupRecentToursByMilestone,
  saveRecentlyViewedTour,
  getRecentlyViewedRecords,
  removeRecentlyViewedTour,
} from '@/features/tours';
import type { TourListItem } from '@/features/tours/types/tour.types';

describe('wishlistCollections & recentTours utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes default collection when none exists', () => {
    const list = getWishlistCollections('user1');
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('default');
    expect(list[0].name).toBe('Danh sách yêu thích');
  });

  it('creates a new collection and adds to list', () => {
    const newCol = createWishlistCollection('Kỳ nghỉ hè', 'tour-123', 'user1');
    expect(newCol.name).toBe('Kỳ nghỉ hè');
    expect(newCol.tourIds).toContain('tour-123');

    const list = getWishlistCollections('user1');
    expect(list.some((c) => c.name === 'Kỳ nghỉ hè')).toBe(true);
  });

  it('retrieves the latest collection based on updatedAt/createdAt', () => {
    createWishlistCollection('Mục cũ', 'tour-1', 'user1');
    const newer = createWishlistCollection('Mục mới nhất', 'tour-2', 'user1');

    const latest = getLatestWishlistCollection('user1');
    expect(latest.id).toBe(newer.id);
    expect(latest.name).toBe('Mục mới nhất');
  });

  it('addTourToLatestCollection saves tour to the newest collection', () => {
    createWishlistCollection('ok', undefined, 'user1');
    const updated = addTourToLatestCollection('tour-999', 'user1');
    expect(updated.name).toBe('ok');
    expect(updated.tourIds).toContain('tour-999');
  });

  it('deletes collection by id', () => {
    const col = createWishlistCollection('Cần xóa', undefined, 'user1');
    deleteWishlistCollection(col.id, 'user1');
    const list = getWishlistCollections('user1');
    expect(list.some((c) => c.id === col.id)).toBe(false);
  });

  it('removes a tour from all collections when unhearted', () => {
    const col1 = createWishlistCollection('Col 1', 'tour-x', 'user1');
    const col2 = createWishlistCollection('Col 2', 'tour-x', 'user1');

    removeTourFromAllCollections('tour-x', 'user1');

    const list = getWishlistCollections('user1');
    expect(list.find((c) => c.id === col1.id)?.tourIds).not.toContain('tour-x');
    expect(list.find((c) => c.id === col2.id)?.tourIds).not.toContain('tour-x');
  });

  it('formats Vietnamese milestone date correctly', () => {
    // 2026-11-01 is Sunday (Chủ Nhật)
    const formatted = formatMilestoneDate('2026-11-01T10:00:00.000Z');
    expect(formatted).toContain('Chủ Nhật');
    expect(formatted).toContain('1 tháng 11');
  });

  it('saves, retrieves, and removes recently viewed tours with viewedAt timestamps', () => {
    const mockTour: TourListItem = {
      id: 'tour-mock-1',
      title: 'Tour Khám Phá Ninh Bình',
      coverImage: 'https://example.com/img.jpg',
      basePrice: 1500000,
      durationDays: 2,
      ratingAvg: 4.8,
      categoryIds: ['c1'],
      destination: 'Ninh Bình',
      ratingCount: 12,
    };

    saveRecentlyViewedTour(mockTour);
    const records = getRecentlyViewedRecords();
    expect(records.length).toBe(1);
    expect(records[0].tour.id).toBe('tour-mock-1');
    expect(records[0].viewedAt).toBeDefined();

    const groups = groupRecentToursByMilestone(records);
    expect(groups.length).toBe(1);
    expect(groups[0].records[0].tour.title).toBe('Tour Khám Phá Ninh Bình');

    removeRecentlyViewedTour('tour-mock-1');
    expect(getRecentlyViewedRecords().length).toBe(0);
  });
});
