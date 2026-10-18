import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { earning, meta, queryResult } from './finance.fixtures';
const mocks = vi.hoisted(() => ({ list: vi.fn(), summary: vi.fn() }));
vi.mock('../api/earningsApi', () => ({
  useGetMyEarningsQuery: (...args: unknown[]) => mocks.list(...args),
  useGetMyEarningsSummaryQuery: (...args: unknown[]) => mocks.summary(...args),
}));
import { EarningsContent } from '../components/GuideEarningsPage';

beforeEach(() => {
  mocks.list.mockReturnValue(
    queryResult({
      items: [earning],
      meta: { ...meta, total: 12, totalPages: 2 },
    }),
  );
  mocks.summary.mockReturnValue(
    queryResult({
      totalAmount: 3000000,
      count: 12,
      byMonth: [{ month: '2026-10', totalAmount: 3000000, count: 12 }],
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('View Earnings', () => {
  it('uses backend summary rather than the visible page and shows booking facts without a traveler link', () => {
    render(<EarningsContent />);
    expect(screen.getAllByText(/3\.000\.000/)).toHaveLength(2);
    expect(screen.getByText('Booking: BK001')).toBeTruthy();
    expect(screen.getByText('Thu nhập theo tháng (UTC)')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('resets page and shares Vietnam date bounds with summary; invalid dates are not applied', () => {
    render(<EarningsContent />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(mocks.list.mock.calls.at(-1)![0].page).toBe(2);
    fireEvent.change(screen.getByLabelText('Từ ngày'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByLabelText('Đến ngày'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(mocks.list.mock.calls.at(-1)![0]).toEqual({
      page: 1,
      limit: 10,
      from: '2026-09-30T17:00:00.000Z',
      to: '2026-10-01T16:59:59.999Z',
    });
    expect(mocks.summary.mock.calls.at(-1)![0]).toEqual({
      from: '2026-09-30T17:00:00.000Z',
      to: '2026-10-01T16:59:59.999Z',
    });
    fireEvent.change(screen.getByLabelText('Từ ngày'), {
      target: { value: '2026-10-02' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(screen.getByRole('alert').textContent).toContain('Ngày bắt đầu');
    expect(mocks.summary.mock.calls.at(-1)![0].from).toBe(
      '2026-09-30T17:00:00.000Z',
    );
  });
  it('does not display stale previous-filter rows while the current query loads', () => {
    mocks.list.mockReturnValue(
      queryResult(undefined, {
        data: { items: [earning], meta },
        isFetching: true,
      }),
    );
    mocks.summary.mockReturnValue(queryResult(undefined, { isError: true }));
    render(<EarningsContent />);
    expect(screen.getByText('Đang tải lịch sử thu nhập...')).toBeTruthy();
    expect(screen.getByText('Không thể tải tổng hợp thu nhập')).toBeTruthy();
    expect(screen.queryByText('Booking: BK001')).toBeNull();
    expect(screen.queryByText(/3\.000\.000/)).toBeNull();
  });
  it('distinguishes empty earnings from filtered empty results', () => {
    mocks.list.mockReturnValue(queryResult({ items: [], meta }));
    mocks.summary.mockReturnValue(
      queryResult({ totalAmount: 0, count: 0, byMonth: [] }),
    );
    render(<EarningsContent />);
    expect(screen.getByText('Chưa có thu nhập')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Từ ngày'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(
      screen.getByText('Không có thu nhập trong khoảng đã chọn'),
    ).toBeTruthy();
  });
});
