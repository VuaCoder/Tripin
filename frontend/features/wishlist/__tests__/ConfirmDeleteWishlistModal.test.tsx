import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDeleteWishlistModal } from '../components/ConfirmDeleteWishlistModal';
import type { WishlistItem } from '../types';

afterEach(cleanup);

const MOCK_ITEM: WishlistItem = {
  tourId: 't-123',
  addedAt: '2026-03-01T00:00:00.000Z',
  available: true,
  tour: {
    id: 't-123',
    title: 'Tour Du Lịch Phú Quốc 3N2Đ',
    destination: 'Phú Quốc',
    durationDays: 3,
    basePrice: 3_200_000,
    categoryIds: [],
    ratingAvg: 4.8,
    ratingCount: 12,
    coverImage: 'https://example.com/phuquoc.jpg',
  },
};

describe('ConfirmDeleteWishlistModal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <ConfirmDeleteWishlistModal
        isOpen={false}
        item={MOCK_ITEM}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal with tour information and confirmation buttons', () => {
    render(
      <ConfirmDeleteWishlistModal
        isOpen={true}
        item={MOCK_ITEM}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Xóa khỏi danh sách yêu thích?')).toBeDefined();
    expect(screen.getByText('Tour Du Lịch Phú Quốc 3N2Đ')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Không, giữ lại' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Xác nhận xóa/ })).toBeDefined();
  });

  it('calls onClose when clicking cancel button or close button', () => {
    const onClose = vi.fn();
    render(
      <ConfirmDeleteWishlistModal
        isOpen={true}
        item={MOCK_ITEM}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Không, giữ lại' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Đóng'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls onConfirm when clicking confirm delete button', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteWishlistModal
        isOpen={true}
        item={MOCK_ITEM}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Xác nhận xóa/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables buttons and shows spinner when isLoading is true', () => {
    render(
      <ConfirmDeleteWishlistModal
        isOpen={true}
        item={MOCK_ITEM}
        isLoading={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Không, giữ lại' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Đang xóa.../ })).toHaveProperty('disabled', true);
  });
});
