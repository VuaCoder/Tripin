import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
      createElement('a', { href, className }, children as never),
  };
});

import { WishlistItemCard } from '../components/WishlistItemCard';
import type { WishlistItem } from '../types';

afterEach(cleanup);

const AVAILABLE: WishlistItem = {
  tourId: 't1',
  addedAt: '2026-01-01T00:00:00.000Z',
  available: true,
  tour: {
    id: 't1',
    title: 'Hạ Long 2N1Đ',
    destination: 'Quảng Ninh',
    durationDays: 2,
    basePrice: 1_500_000,
    categoryIds: [],
    ratingAvg: 4.5,
    ratingCount: 3,
  },
};

describe('WishlistItemCard', () => {
  it('links an available tour back to its detail page', () => {
    render(<WishlistItemCard item={AVAILABLE} />);

    expect(screen.getByRole('link', { name: 'Hạ Long 2N1Đ' }).getAttribute('href')).toBe('/tours/t1');
    expect(screen.getByRole('link', { name: 'Xem chi tiết' }).getAttribute('href')).toBe('/tours/t1');
  });

  it('shows a notice and no detail link when the tour is gone, but still lets the traveler remove it', () => {
    const onRemove = vi.fn();
    render(<WishlistItemCard item={{ tourId: 't9', addedAt: AVAILABLE.addedAt, available: false }} onRemove={onRemove} />);

    expect(screen.getByRole('status').textContent).toMatch(/ngừng bán|gỡ/);
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByLabelText('Bỏ khỏi danh sách yêu thích'));
    expect(onRemove).toHaveBeenCalledWith('t9');
  });
});
