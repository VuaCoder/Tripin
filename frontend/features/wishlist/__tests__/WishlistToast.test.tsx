import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WishlistToast, showWishlistToast, hideWishlistToast } from '../components/WishlistToast';

afterEach(cleanup);

describe('WishlistToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing initially', () => {
    const { container } = render(<WishlistToast />);
    expect(container.firstChild).toBeNull();
  });

  it('shows saved toast with collection name, Thay đổi button, and bottom-left position', () => {
    render(<WishlistToast />);

    act(() => {
      showWishlistToast({
        tourId: 'tour-1',
        tourTitle: 'Tour Vịnh Hạ Long',
        tourCoverImage: 'https://example.com/cover.jpg',
        collectionName: 'Kỳ nghỉ hè 2026',
        collectionId: 'col-1',
        action: 'saved',
      });
    });

    const toastElement = screen.getByRole('status');
    expect(toastElement).toBeTruthy();
    expect(toastElement.className).toContain('fixed bottom-6 left-6');
    expect(toastElement.textContent).toContain('Đã lưu vào');
    expect(toastElement.textContent).toContain('Kỳ nghỉ hè 2026');
    expect(screen.getByRole('button', { name: 'Thay đổi' })).toBeTruthy();
  });

  it('shows removed toast with collection name and no Thay đổi button', () => {
    render(<WishlistToast />);

    act(() => {
      showWishlistToast({
        tourId: 'tour-1',
        tourTitle: 'Tour Vịnh Hạ Long',
        tourCoverImage: 'https://example.com/cover.jpg',
        collectionName: 'Kỳ nghỉ hè 2026',
        collectionId: 'col-1',
        action: 'removed',
      });
    });

    const toastElement = screen.getByRole('status');
    expect(toastElement).toBeTruthy();
    expect(toastElement.className).toContain('fixed bottom-6 left-6');
    expect(toastElement.textContent).toContain('Đã xoá khỏi');
    expect(toastElement.textContent).toContain('Kỳ nghỉ hè 2026');
    expect(screen.queryByRole('button', { name: 'Thay đổi' })).toBeNull();
  });

  it('automatically dismisses after 3 seconds', () => {
    render(<WishlistToast />);

    act(() => {
      showWishlistToast({
        tourId: 'tour-1',
        tourTitle: 'Tour Vịnh Hạ Long',
        collectionName: 'Danh sách yêu thích',
        collectionId: 'col-1',
        action: 'removed',
      });
    });

    expect(screen.getByRole('status')).toBeTruthy();

    // Fast-forward 3000ms
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('closes immediately when clicking the close button', () => {
    render(<WishlistToast />);

    act(() => {
      showWishlistToast({
        tourId: 'tour-1',
        collectionName: 'Danh sách yêu thích',
        collectionId: 'col-1',
        action: 'saved',
      });
    });

    const closeBtn = screen.getByRole('button', { name: 'Đóng thông báo' });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('status')).toBeNull();
  });
});

