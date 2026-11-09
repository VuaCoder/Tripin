import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ id: 'tour-1', loading: true }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: mocks.id }) }));
vi.mock('@/components/shared', () => ({ LoadingState: () => null, ErrorState: () => null }));
vi.mock('@/features/review', () => ({
  useGetTourDetailQuery: () => ({ data: mocks.loading ? undefined : { id: mocks.id }, isLoading: mocks.loading }),
}));
vi.mock('@/features/tours/components/detail/TourDetailView', () => ({ TourDetailView: () => null }));

import TourDetailPage from '@/app/tours/[id]/page';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.id = 'tour-1';
  mocks.loading = true;
});

it('shows the detail skeleton while fetching and removes it when the tour arrives', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const { rerender } = render(<TourDetailPage />);
  expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
  expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Đang tải thông tin tour');
  expect(screen.queryByRole('button')).toBeNull();
  mocks.loading = false;
  rerender(<TourDetailPage />);
  expect(screen.queryByRole('status')).toBeNull();
});

it('resets scroll on entry and when switching tours, without resetting after data loads', () => {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const { rerender } = render(<TourDetailPage />);
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });

  mocks.loading = false;
  rerender(<TourDetailPage />);
  expect(scrollTo).toHaveBeenCalledTimes(1);

  mocks.id = 'tour-2';
  rerender(<TourDetailPage />);
  expect(scrollTo).toHaveBeenCalledTimes(2);
});
