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
  useGenerateAgencyBatchMutation: () => [vi.fn(), { isLoading: false }],
  useLazyGetAgencyBatchQuery: () => [vi.fn(), { data: { items: [], meta: { total: 0 } }, isFetching: false }],
}));

import { AgencyPromotionsPage } from '../components/AgencyPromotionsPage';

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

const promotion: AgencyPromotion = {
  id: 'p1',
  scope: 'AGENCY',
  applyType: 'CODE',
  codeType: 'SHARED',
  code: 'HE2026',
  title: 'Giảm hè',
  discountType: 'PERCENT',
  discountValue: 10,
  minOrderAmount: 0,
  startsAt: '2026-11-01T01:00:00.000Z',
  endsAt: '2099-12-01T01:00:00.000Z',
  usedCount: 2,
  isActive: true,
  isArchived: false,
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
    fireEvent.click(screen.getByRole('heading', { name: 'Public Promo Code' }));
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

  it('updates query when searching and selecting dropdown filters', async () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [promotion], meta: META } }));
    render(<AgencyPromotionsPage />);

    // Search input
    const searchInput = screen.getByPlaceholderText(/Tìm theo mã hoặc tiêu đề/);
    fireEvent.change(searchInput, { target: { value: 'SUMMER' } });
    fireEvent.submit(searchInput.closest('form')!);
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ q: 'SUMMER' }));

    // AntSelect filter dropdown for apply type
    const typeDropdown = screen.getByLabelText('Lọc theo hình thức');
    fireEvent.click(typeDropdown);
    const sharedOption = screen.getByRole('option', { name: /Public Promo Code/ });
    fireEvent.click(sharedOption);
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ applyType: 'CODE', codeType: 'SHARED' }));

    // AntSelect filter dropdown for status
    const statusDropdown = screen.getByLabelText('Lọc theo trạng thái');
    fireEvent.click(statusDropdown);
    const activeOption = screen.getByRole('option', { name: /Đang hoạt động/ });
    fireEvent.click(activeOption);
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));

    // Quick filter pill
    const autoApplyPill = screen.getByRole('button', { name: /Auto-Apply/ });
    fireEvent.click(autoApplyPill);
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ applyType: 'AUTO_APPLY' }));
  });

  it('handles archiving and unarchiving promotions', async () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [promotion], meta: META } }));
    mockUpdate.mockReturnValue(resolving({ ...promotion, isArchived: true, isActive: false }));
    render(<AgencyPromotionsPage />);

    // Click "Lưu trữ" button on card
    const archiveBtn = screen.getByTitle('Lưu trữ khuyến mãi');
    fireEvent.click(archiveBtn);

    // Confirmation modal opens
    expect(screen.getByText('Xác nhận lưu trữ khuyến mãi')).toBeTruthy();
    expect(screen.getByText('Hủy bỏ')).toBeTruthy();

    // Confirm archiving
    const confirmBtn = screen.getByText('Xác nhận lưu trữ');
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(screen.getByText('Đã chuyển khuyến mãi vào mục lưu trữ.')).toBeTruthy());
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'p1', patch: { isArchived: true, isActive: false } });
  });

  it('cancels archiving when clicking Hủy bỏ in confirmation modal', () => {
    mockQuery.mockReturnValue(queryResult({ data: { items: [promotion], meta: META } }));
    render(<AgencyPromotionsPage />);

    // Click "Lưu trữ" button on card
    const archiveBtn = screen.getByTitle('Lưu trữ khuyến mãi');
    fireEvent.click(archiveBtn);

    // Modal appears
    expect(screen.getByText('Xác nhận lưu trữ khuyến mãi')).toBeTruthy();

    // Click "Hủy bỏ"
    const cancelBtn = screen.getByText('Hủy bỏ');
    fireEvent.click(cancelBtn);

    // Modal closes without calling update
    expect(screen.queryByText('Xác nhận lưu trữ khuyến mãi')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('filters by archived status via status dropdown and shows distinct archived card', () => {
    const archivedPromotion: AgencyPromotion = {
      ...promotion,
      id: 'p2',
      title: 'Khuyến mãi cũ',
      isActive: false,
      isArchived: true,
      isRunning: false,
    };
    mockQuery.mockReturnValue(queryResult({ data: { items: [archivedPromotion], meta: META } }));
    render(<AgencyPromotionsPage />);

    // Select "Đã lưu trữ" from status filter dropdown
    const statusDropdown = screen.getByLabelText('Lọc theo trạng thái');
    fireEvent.click(statusDropdown);
    const archivedOption = screen.getByRole('option', { name: /Đã lưu trữ/ });
    fireEvent.click(archivedOption);

    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ isArchived: true }));
    expect(screen.getByText('(Đã lưu trữ)')).toBeTruthy();
    expect(screen.getByText('Bỏ lưu trữ')).toBeTruthy();
  });

  it('renders inactive promotion with clear (Tạm ngưng) tag and distinct styling', () => {
    const inactivePromotion: AgencyPromotion = {
      ...promotion,
      id: 'p3',
      title: 'Mã tắt thử nghiệm',
      isActive: false,
      isArchived: false,
      isRunning: false,
    };
    mockQuery.mockReturnValue(queryResult({ data: { items: [inactivePromotion], meta: META } }));
    render(<AgencyPromotionsPage />);

    expect(screen.getByText('(Tạm ngưng)')).toBeTruthy();
    expect(screen.getByText('Bật')).toBeTruthy();
    expect(screen.getAllByText('Đã tắt').length).toBeGreaterThanOrEqual(1);
  });
});
