import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgencyPromotion } from '../types';

const mockQuery = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../api/agencyPromotionsApi', () => ({
  useGetAgencyPromotionsQuery: (args: unknown) => mockQuery(args),
  useCreateAgencyPromotionMutation: () => [mockCreate, { isLoading: false }],
  useUpdateAgencyPromotionMutation: () => [mockUpdate, { isLoading: false }],
}));

import { AgencyPromotionsPage } from '../components/AgencyPromotionsPage';

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

const promotion: AgencyPromotion = {
  id: 'p1',
  scope: 'AGENCY',
  code: 'HE2026',
  title: 'Giảm hè',
  discountType: 'PERCENT',
  discountValue: 10,
  minOrderAmount: 0,
  startsAt: '2026-11-01T01:00:00.000Z',
  endsAt: '2099-12-01T01:00:00.000Z',
  usedCount: 2,
  isActive: true,
  isRunning: true,
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

const rejecting = (data: unknown) => ({ unwrap: () => Promise.reject({ status: 409, data }) });
const resolving = (data: unknown) => ({ unwrap: () => Promise.resolve(data) });

describe('AgencyPromotionsPage', () => {
  it('shows loading, error (with retry) and empty states', () => {
    mockQuery.mockReturnValue(queryResult({ isLoading: true }));
    const { unmount } = render(<AgencyPromotionsPage />);
    expect(screen.getByRole('status')).toBeTruthy();
    unmount();

    const refetch = vi.fn();
    mockQuery.mockReturnValue(queryResult({ isError: true, refetch }));
    const second = render(<AgencyPromotionsPage />);
    fireEvent.click(screen.getByText('Thử lại'));
    expect(refetch).toHaveBeenCalled();
    second.unmount();

    mockQuery.mockReturnValue(queryResult({ data: { items: [], meta: { ...META, total: 0 } } }));
    render(<AgencyPromotionsPage />);
    expect(screen.getByText('Chưa có khuyến mãi nào')).toBeTruthy();
  });

  it('renders promotions as returned by the backend', () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [promotion], meta: META } }));
    render(<AgencyPromotionsPage />);
    expect(screen.getByText('HE2026')).toBeTruthy();
    expect(screen.getByText('Đang chạy')).toBeTruthy();
    expect(screen.getByText(/Đã dùng 2/)).toBeTruthy();
  });

  it('locks code, type and discount value when editing a used promotion', () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [promotion], meta: META } }));
    render(<AgencyPromotionsPage />);
    fireEvent.click(screen.getByText('Chỉnh sửa'));

    expect((screen.getByLabelText(/Mã khuyến mãi/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Loại giảm giá/) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Mức giảm/) as HTMLInputElement).disabled).toBe(true);
  });

  it('does not call the backend when the form is invalid', () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [], meta: { ...META, total: 0 } } }));
    render(<AgencyPromotionsPage />);
    fireEvent.click(screen.getAllByText('Tạo khuyến mãi')[0]);
    fireEvent.click(screen.getByText('Tạo khuyến mãi', { selector: 'button[type="submit"]' }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('keeps the dialog open and shows the backend error without a success message', async () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [promotion], meta: META } }));
    mockUpdate.mockReturnValue(rejecting({ error: { code: 'PROMOTION_IN_USE', message: 'in use' } }));
    render(<AgencyPromotionsPage />);
    fireEvent.click(screen.getByText('Chỉnh sửa'));
    fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Giảm hè lớn' } });
    fireEvent.click(screen.getByText('Lưu thay đổi'));

    await waitFor(() => expect(screen.getByText(/đã có người sử dụng/)).toBeTruthy());
    expect(screen.queryByText('Đã cập nhật khuyến mãi.')).toBeNull();
    expect(screen.getByText('Lưu thay đổi')).toBeTruthy();
  });

  it('reports success only after the backend confirms', async () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [promotion], meta: META } }));
    mockUpdate.mockReturnValue(resolving({ ...promotion, title: 'Giảm hè lớn' }));
    render(<AgencyPromotionsPage />);
    fireEvent.click(screen.getByText('Chỉnh sửa'));
    fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Giảm hè lớn' } });
    fireEvent.click(screen.getByText('Lưu thay đổi'));

    await waitFor(() => expect(screen.getByText('Đã cập nhật khuyến mãi.')).toBeTruthy());
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'p1', patch: { title: 'Giảm hè lớn' } });
  });

  it('toggles isActive and reports a backend failure', async () => {
    const refetch = vi.fn();
    mockQuery.mockReturnValue(queryResult({ data: { items: [promotion], meta: META }, refetch }));
    mockUpdate.mockReturnValue(rejecting({ error: { code: 'X', message: 'Không thể tắt' } }));
    render(<AgencyPromotionsPage />);
    fireEvent.click(screen.getByText('Tắt'));

    await waitFor(() => expect(screen.getByText('Không thể tắt')).toBeTruthy());
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'p1', patch: { isActive: false } });
    expect(refetch).toHaveBeenCalled();
  });
});
