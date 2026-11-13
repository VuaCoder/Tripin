import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TourPrintView } from '../components/detail/TourPrintView';
import type { TourReviewContext } from '@/features/review/types';

afterEach(cleanup);

it('prints all itinerary days and policies without reviews or booking controls', () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const tour = {
    id: 't1', title: 'Khám phá Ninh Bình', destination: 'Ninh Bình', durationDays: 2,
    basePrice: 1000000, ratingAvg: 5, ratingCount: 20,
    itinerary: [{ day: 1, title: 'Tràng An', activities: ['Đi thuyền'] }, { day: 2, title: 'Tam Cốc', description: 'Đạp xe qua làng quê', activities: [] }],
    inclusions: ['Xe đưa đón'], exclusions: ['Chi phí cá nhân'],
    travelNotes: 'Mang giày đi bộ', cancellationPolicy: 'Liên hệ trước khi hủy', requiredDocuments: 'Mang giấy tờ tùy thân',
    departures: [{ id: 'd1', date: '2099-01-01', isOpen: true, remaining: 5, price: 1200000 }],
  } as TourReviewContext;
  render(<TourPrintView tour={tour} />);
  for (const text of ['Đi thuyền', 'Đạp xe qua làng quê', 'Xe đưa đón', 'Chi phí cá nhân', 'Mang giày đi bộ', 'Liên hệ trước khi hủy', 'Mang giấy tờ tùy thân']) expect(screen.getByText(text)).toBeTruthy();
  expect(screen.queryByText(/đánh giá/i)).toBeNull();
  expect(screen.queryByRole('button', { name: /đặt tour/i })).toBeNull();
  expect(screen.getByRole('table')).toBeTruthy();
  print.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'In chương trình' }));
  expect(print).toHaveBeenCalledOnce();
  print.mockRestore();
});
