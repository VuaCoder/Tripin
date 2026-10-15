import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GuideAssignedTour } from '../types';

const mockUseGetAssignedToursQuery = vi.fn();
const mockAnswerAssignment = vi.fn();

vi.mock('../api/guideApi', () => ({
  useGetAssignedToursQuery: (args: unknown) => mockUseGetAssignedToursQuery(args),
  useAnswerAssignmentMutation: () => [mockAnswerAssignment, { isLoading: false }],
}));

import { GuideAssignedToursPage } from '../components/GuideAssignedToursPage';

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

const pendingTour: GuideAssignedTour = {
  id: 'tour-1',
  title: 'Tour Hạ Long 2N1Đ',
  destination: 'Quảng Ninh',
  durationDays: 2,
  tourStatus: 'APPROVED',
  agencyId: 'agency-1',
  agency: { id: 'agency-1', name: 'Tripri Travel' },
  assignment: { feePerBooking: 500_000, status: 'PENDING' },
  nextDepartureDate: '2026-12-01T00:00:00.000Z',
};

const acceptedTour: GuideAssignedTour = {
  ...pendingTour,
  id: 'tour-2',
  title: 'Tour Đà Nẵng 3N2Đ',
  assignment: { feePerBooking: 800_000, status: 'ACCEPTED', respondedAt: '2026-11-05T00:00:00.000Z' },
};

const queryResult = (overrides: Record<string, unknown>) => ({
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GuideAssignedToursPage', () => {
  it('shows the empty state when no tour is assigned', () => {
    mockUseGetAssignedToursQuery.mockReturnValue(queryResult({ data: { items: [], meta: { ...META, total: 0 } } }));

    render(<GuideAssignedToursPage />);

    expect(screen.getByText('Chưa có tour nào được phân công')).toBeTruthy();
  });

  it('shows an error state with a retry action when the request fails', () => {
    const refetch = vi.fn();
    mockUseGetAssignedToursQuery.mockReturnValue(queryResult({ isError: true, refetch }));

    render(<GuideAssignedToursPage />);

    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('offers accept/decline only on a PENDING assignment and sends the answer', async () => {
    mockUseGetAssignedToursQuery.mockReturnValue(queryResult({ data: { items: [pendingTour, acceptedTour], meta: META } }));
    mockAnswerAssignment.mockReturnValue({ unwrap: () => Promise.resolve(acceptedTour) });

    render(<GuideAssignedToursPage />);

    // The already-answered assignment has no verify actions left.
    expect(screen.getAllByRole('button', { name: /Nhận tour/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Từ chối' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Nhận tour/ }));
    fireEvent.change(screen.getByLabelText(/Ghi chú/), { target: { value: 'Sẵn sàng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nhận tour' }));

    await waitFor(() =>
      expect(mockAnswerAssignment).toHaveBeenCalledWith({ tourId: 'tour-1', accept: true, note: 'Sẵn sàng' }),
    );
    expect(await screen.findByText('Bạn đã nhận tour thành công.')).toBeTruthy();
  });

  it('reports a failed answer and refreshes the list', async () => {
    const refetch = vi.fn();
    mockUseGetAssignedToursQuery.mockReturnValue(queryResult({ data: { items: [pendingTour], meta: META }, refetch }));
    mockAnswerAssignment.mockReturnValue({
      unwrap: () => Promise.reject({ data: { error: { message: 'Guide assignment not found' } } }),
    });

    render(<GuideAssignedToursPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));

    expect(await screen.findByText('Guide assignment not found')).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });
});
