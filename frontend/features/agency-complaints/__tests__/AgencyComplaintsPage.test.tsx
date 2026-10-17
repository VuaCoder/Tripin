import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Complaint } from '../types';

const mockQuery = vi.fn();
const mockRespond = vi.fn();

vi.mock('../api/agencyComplaintsApi', () => ({
  useGetAgencyComplaintsQuery: (args: unknown) => mockQuery(args),
  useRespondToComplaintMutation: () => [mockRespond, { isLoading: false }],
}));

import { AgencyComplaintsPage } from '../components/AgencyComplaintsPage';
import { validateResponseText } from '../labels';

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

const open: Complaint = {
  id: 'c1',
  targetType: 'TOUR',
  targetId: 't1',
  category: 'SERVICE_QUALITY',
  description: 'Hướng dẫn viên đến muộn',
  status: 'OPEN',
  reporterName: 'Nguyen A.',
  createdAt: '2026-10-10T00:00:00.000Z',
};

const answered: Complaint = {
  ...open,
  id: 'c2',
  status: 'AGENCY_RESPONDED',
  agencyResponse: { text: 'Chúng tôi xin lỗi', respondedAt: '2026-10-11T00:00:00.000Z' },
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

describe('validateResponseText', () => {
  it('mirrors the backend 5..2000 rule', () => {
    expect(validateResponseText('abcd')).toBeTruthy();
    expect(validateResponseText('  abcd  ')).toBeTruthy();
    expect(validateResponseText('abcde')).toBeNull();
    expect(validateResponseText('x'.repeat(2001))).toBeTruthy();
  });
});

describe('AgencyComplaintsPage', () => {
  it('shows loading, error (with retry) and empty states', () => {
    mockQuery.mockReturnValue(queryResult({ isLoading: true }));
    const first = render(<AgencyComplaintsPage />);
    expect(screen.getByRole('status')).toBeTruthy();
    first.unmount();

    const refetch = vi.fn();
    mockQuery.mockReturnValue(queryResult({ isError: true, refetch }));
    const second = render(<AgencyComplaintsPage />);
    fireEvent.click(screen.getByText('Thử lại'));
    expect(refetch).toHaveBeenCalled();
    second.unmount();

    mockQuery.mockReturnValue(queryResult({ data: { items: [], meta: { ...META, total: 0 } } }));
    render(<AgencyComplaintsPage />);
    expect(screen.getByText('Chưa có khiếu nại nào')).toBeTruthy();
  });

  it('shows only the masked reporter name from the backend', () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [open], meta: META } }));
    render(<AgencyComplaintsPage />);
    expect(screen.getByText(/Nguyen A\./)).toBeTruthy();
    expect(screen.getAllByText('Chờ phản hồi').length).toBeGreaterThan(1);
  });

  it('blocks a too-short response without calling the backend', () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [open], meta: META } }));
    render(<AgencyComplaintsPage />);
    fireEvent.click(screen.getByText('Xem & phản hồi'));
    fireEvent.change(screen.getByLabelText(/Phản hồi của đại lý/), { target: { value: 'ab' } });
    fireEvent.click(screen.getByText('Gửi phản hồi'));

    expect(mockRespond).not.toHaveBeenCalled();
    expect(screen.getByText(/ít nhất 5 ký tự/)).toBeTruthy();
  });

  it('reports success only after the backend confirms, then closes the dialog', async () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [open], meta: META } }));
    mockRespond.mockReturnValue({ unwrap: () => Promise.resolve({ ...open, status: 'AGENCY_RESPONDED' }) });
    render(<AgencyComplaintsPage />);
    fireEvent.click(screen.getByText('Xem & phản hồi'));
    fireEvent.change(screen.getByLabelText(/Phản hồi của đại lý/), { target: { value: 'Chúng tôi xin lỗi quý khách' } });
    fireEvent.click(screen.getByText('Gửi phản hồi'));

    await waitFor(() => expect(screen.getByText('Đã gửi phản hồi cho khiếu nại.')).toBeTruthy());
    expect(mockRespond).toHaveBeenCalledWith({ id: 'c1', text: 'Chúng tôi xin lỗi quý khách' });
    expect(screen.queryByLabelText(/Phản hồi của đại lý/)).toBeNull();
  });

  it('shows the backend error, no success message, and refetches on a state conflict', async () => {
    const refetch = vi.fn();
    mockQuery.mockReturnValue(queryResult({ data: { items: [open], meta: META }, refetch }));
    mockRespond.mockReturnValue({
      unwrap: () => Promise.reject({ status: 409, data: { error: { code: 'INVALID_STATE_TRANSITION', message: 'conflict' } } }),
    });
    render(<AgencyComplaintsPage />);
    fireEvent.click(screen.getByText('Xem & phản hồi'));
    fireEvent.change(screen.getByLabelText(/Phản hồi của đại lý/), { target: { value: 'Chúng tôi xin lỗi quý khách' } });
    fireEvent.click(screen.getByText('Gửi phản hồi'));

    await waitFor(() => expect(screen.getByText(/đã được xử lý/)).toBeTruthy());
    expect(screen.queryByText('Đã gửi phản hồi cho khiếu nại.')).toBeNull();
    expect(refetch).toHaveBeenCalled();
  });

  it('offers no response form once the complaint is no longer OPEN', () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [answered], meta: META } }));
    render(<AgencyComplaintsPage />);
    fireEvent.click(screen.getByText('Xem chi tiết'));

    expect(screen.getByText('Chúng tôi xin lỗi')).toBeTruthy();
    expect(screen.queryByText('Gửi phản hồi')).toBeNull();
  });
});
