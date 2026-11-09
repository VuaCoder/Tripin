import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlaTrends } from '../components/SlaTrends';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('@/store/api/baseApi', () => ({
  baseApi: {
    injectEndpoints: () => ({
      useSlaTrendQuery: (...args: unknown[]) => mocks.query(...args),
    }),
  },
}));

describe('SlaTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('renders SLA title, legend and chart when data is present', () => {
    mocks.query.mockReturnValue({
      data: {
        generatedAt: '2026-11-04T00:00:00Z',
        rows: [
          { day: '2026-11-01', onTime: 42, nearOverdue: 2, breached: 5, unknown: 0 },
          { day: '2026-11-02', onTime: 55, nearOverdue: 1, breached: 7, unknown: 0 },
          { day: '2026-11-03', onTime: 65, nearOverdue: 3, breached: 12, unknown: 0 },
          { day: '2026-11-04', onTime: 70, nearOverdue: 0, breached: 10, unknown: 0 },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<SlaTrends />);
    expect(screen.getByText('Tiến độ xử lý đúng hạn')).toBeTruthy();
    expect(screen.getByText(/Xử lý đúng hạn: 232 phiếu/)).toBeTruthy();
    expect(screen.getByText(/Bị trễ hạn: 34 phiếu/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Biểu đồ xu hướng SLA' })).toBeTruthy();
  });

  it('renders loading state', () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    render(<SlaTrends />);
    expect(screen.getByText('Đang tải biểu đồ xu hướng...')).toBeTruthy();
  });

  it('renders error state and retry button', () => {
    const refetch = vi.fn();
    mocks.query.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });

    render(<SlaTrends />);
    expect(screen.getByText('Không tải được dữ liệu tiến độ xử lý.')).toBeTruthy();
  });
});

