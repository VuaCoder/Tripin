import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboard, meta, policy, promotion, query, user } from './fixtures';

const mocks = vi.hoisted(() => ({
  session: vi.fn(), dashboard: vi.fn(), promotions: vi.fn(), detail: vi.fn(), createPromotion: vi.fn(), updatePromotion: vi.fn(),
  users: vi.fn(), access: vi.fn(), categories: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), deactivate: vi.fn(),
  commission: vi.fn(), saveCommission: vi.fn(), policies: vi.fn(), savePolicy: vi.fn(),
}));
vi.mock('../components/AdminUi', async (original) => ({ ...await original<object>(), useAdminSession: () => mocks.session() }));
vi.mock('../api/adminApi', () => ({
  useGetAdminDashboardQuery: (...args: unknown[]) => mocks.dashboard(...args),
  useGetAdminPromotionsQuery: (...args: unknown[]) => mocks.promotions(...args),
  useLazyGetAdminPromotionQuery: () => [mocks.detail, { isFetching: false }],
  useCreateAdminPromotionMutation: () => [mocks.createPromotion, { isLoading: false }],
  useUpdateAdminPromotionMutation: () => [mocks.updatePromotion, { isLoading: false }],
  useGenerateAdminBatchMutation: () => [vi.fn(), { isLoading: false }],
  useLazyGetAdminBatchQuery: () => [vi.fn(), { data: { items: [], meta: { total: 0 } }, isFetching: false }],
  useGetAdminUsersQuery: (...args: unknown[]) => mocks.users(...args),
  useAssignAdminAccessMutation: () => [mocks.access, { isLoading: false }],
  useGetAdminCategoriesQuery: (...args: unknown[]) => mocks.categories(...args),
  useCreateAdminCategoryMutation: () => [mocks.createCategory, { isLoading: false }],
  useUpdateAdminCategoryMutation: () => [mocks.updateCategory, { isLoading: false }],
  useDeactivateAdminCategoryMutation: () => [mocks.deactivate, { isLoading: false }],
  useGetAdminCommissionQuery: (...args: unknown[]) => mocks.commission(...args),
  useSetAdminCommissionMutation: () => [mocks.saveCommission, { isLoading: false }],
  useGetAdminPoliciesQuery: (...args: unknown[]) => mocks.policies(...args),
  useSetAdminPolicyMutation: () => [mocks.savePolicy, { isLoading: false }],
}));
import { AdminDashboardPage, AdminPromotionsPage, AdminUsersPage, AdminCategoriesPage, AdminCommissionPage, AdminPoliciesPage } from '../index';

const reject = (status = 500) => ({ unwrap: () => Promise.reject({ status, data: { error: { code: 'FAILED', message: 'Server rejected' } } }) });
beforeEach(() => {
  mocks.session.mockReturnValue({ ready: true, user: { id: 'admin', role: 'SUPER_ADMIN' } });
  mocks.dashboard.mockReturnValue(query(dashboard));
  mocks.promotions.mockReturnValue(query({ items: [promotion], meta }));
  mocks.users.mockReturnValue(query({ items: [user], meta }));
  mocks.categories.mockReturnValue(query([{ id: 'cat', name: 'Beach', slug: 'beach', isActive: true, sortOrder: 0 }]));
  mocks.commission.mockReturnValue(query({ ratePercent: 10, rateBps: 1000 }));
  mocks.policies.mockReturnValue(query([policy]));
  mocks.detail.mockReturnValue({ unwrap: () => Promise.resolve(promotion) });
  for (const mutation of [mocks.createPromotion, mocks.updatePromotion, mocks.access, mocks.createCategory, mocks.updateCategory, mocks.deactivate, mocks.saveCommission, mocks.savePolicy]) mutation.mockImplementation(() => reject());
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ADMIN-01 screen behavior', () => {
  it('applies Vietnam date bounds to dashboard, switches chart metric, and resets to all time', () => {
    render(<AdminDashboardPage />);
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(mocks.dashboard.mock.calls.at(-1)![0]).toEqual({ from: '2026-09-30T17:00:00.000Z', to: '2026-10-05T16:59:59.999Z' });
    expect(screen.getByRole('img', { name: 'Biểu đồ so sánh tổng tiền, doanh thu đại lý và hoa hồng' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Chỉ số biểu đồ'), { target: { value: 'bookings' } });
    expect(screen.getByRole('img', { name: 'Biểu đồ số booking theo tháng' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Toàn thời gian' }));
    expect(mocks.dashboard.mock.calls.at(-1)![0]).toEqual({});
  });
  it('refuses a partial date filter without replacing the current dashboard query', () => {
    render(<AdminDashboardPage />);
    const initial = mocks.dashboard.mock.calls.at(-1)![0];
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(screen.getByText('Vui lòng chọn đủ ngày bắt đầu và kết thúc.')).toBeTruthy();
    expect(mocks.dashboard.mock.calls.at(-1)![0]).toEqual(initial);
  });
  it('searches categories without accents and filters inactive categories', () => {
    mocks.categories.mockReturnValue(query([{ id: 'a', name: 'Đà Nẵng', slug: 'da-nang', isActive: true, sortOrder: 2 }, { id: 'b', name: 'Ẩm thực', slug: 'am-thuc', isActive: false, sortOrder: 1 }]));
    render(<AdminCategoriesPage />);
    fireEvent.change(screen.getByLabelText('Tìm danh mục'), { target: { value: 'da nang' } });
    expect(screen.getByRole('button', { name: 'Sửa Đà Nẵng' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sửa Ẩm thực' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    fireEvent.change(screen.getByLabelText('Trạng thái danh mục'), { target: { value: 'inactive' } });
    expect(screen.getByRole('button', { name: 'Sửa Ẩm thực' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sửa Đà Nẵng' })).toBeNull();
  });
  it('sends promotion text, type and date overlap filters to the backend, resetting page', () => {
    render(<AdminPromotionsPage />);
    fireEvent.change(screen.getByLabelText('Mã hoặc tên khuyến mãi'), { target: { value: 'SAVE' } });
    fireEvent.change(screen.getByLabelText('Loại giảm giá'), { target: { value: 'FIXED' } });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
    expect(mocks.promotions.mock.calls.at(-1)![0]).toMatchObject({ q: 'SAVE', discountType: 'FIXED', page: 1, from: '2026-09-30T17:00:00.000Z', to: '2026-10-05T16:59:59.999Z' });
  });
  it('sends user created-date bounds and clears them when filters reset', () => {
    render(<AdminUsersPage />);
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm người dùng' }));
    expect(mocks.users.mock.calls.at(-1)![0]).toMatchObject({ page: 1, from: '2026-09-30T17:00:00.000Z', to: '2026-10-05T16:59:59.999Z' });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    expect(mocks.users.mock.calls.at(-1)![0]).toEqual({ page: 1, limit: 10 });
  });
  it('renders backend dashboard metrics and UTC monthly figures without fake health/audit claims', () => {
    render(<AdminDashboardPage />);
    expect(screen.getByText('41')).toBeTruthy();
    expect(screen.getAllByText('2026-10').length).toBeGreaterThan(0);
    expect(screen.getByText(/cache tối đa 30 giây/)).toBeTruthy();
    expect(screen.queryByText(/Hệ thống trực tuyến/)).toBeNull();
  });
  it('does not turn dashboard failure into zero KPIs', () => {
    mocks.dashboard.mockReturnValue(query(undefined, { error: { status: 500 } }));
    render(<AdminDashboardPage />);
    expect(screen.getByText('Không thể tải dữ liệu quản trị')).toBeTruthy();
    expect(screen.queryByText('Tổng người dùng')).toBeNull();
  });
  it('never displays previous-filter user rows when the current query has no data yet', () => {
    mocks.users.mockReturnValue(query(undefined, { data: { items: [user], meta }, isFetching: true }));
    render(<AdminUsersPage />);
    expect(screen.getByText('Đang tải dữ liệu quản trị...')).toBeTruthy();
    expect(screen.queryByText('Target User')).toBeNull();
  });
  it('keeps confirmed data with a refresh-failure notice instead of showing a save rollback', () => {
    mocks.commission.mockReturnValue(query({ ratePercent: 10, rateBps: 1000 }, { error: { status: 500 } }));
    render(<AdminCommissionPage />);
    expect(screen.getByText('10%')).toBeTruthy();
    expect(screen.getByText(/Dữ liệu bên dưới là lần tải trước/)).toBeTruthy();
    expect(screen.getByText('Không thể tải dữ liệu quản trị')).toBeTruthy();
  });
  it.each([AdminDashboardPage, AdminPromotionsPage, AdminUsersPage, AdminCategoriesPage, AdminCommissionPage, AdminPoliciesPage])('hides protected content and skips requests without a ready Super Admin session', (Page) => {
    mocks.session.mockReturnValue({ ready: false, user: { role: 'MODERATOR' } });
    const { container } = render(<Page />);
    expect(container.textContent).toBe('');
    const calls = [mocks.dashboard, mocks.promotions, mocks.users, mocks.categories, mocks.commission, mocks.policies].flatMap((m) => m.mock.calls);
    expect(calls.at(-1)?.[1]).toMatchObject({ skip: true });
  });
  it('keeps commission draft after failure and waits for backend before reporting success', async () => {
    let resolve!: (v: object) => void;
    render(<AdminCommissionPage />);
    fireEvent.change(screen.getByLabelText(/Hoa hồng nền tảng \(%\)/), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hoa hồng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));
    await screen.findByText('Server rejected');
    expect((screen.getByLabelText(/Hoa hồng nền tảng \(%\)/) as HTMLInputElement).value).toBe('12.5');
    expect(screen.queryByText(/Đã lưu mức hoa hồng/)).toBeNull();
    mocks.saveCommission.mockReturnValue({ unwrap: () => new Promise((r) => { resolve = r; }) });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hoa hồng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));
    expect(screen.queryByText(/Đã lưu mức hoa hồng/)).toBeNull();
    resolve({ ratePercent: 12.5, rateBps: 1250 });
    await screen.findByText(/Đã lưu mức hoa hồng/);
    expect(screen.getByText('12.5%')).toBeTruthy();
  });
  it('rejects blank commission without sending a save request', () => {
    render(<AdminCommissionPage />);
    fireEvent.change(screen.getByLabelText(/Hoa hồng nền tảng \(%\)/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hoa hồng' }));
    expect(screen.getByRole('alert').textContent).toContain('Nhập mức');
    expect(mocks.saveCommission).not.toHaveBeenCalled();
  });
  it('removes private commission content when backend says permissions were revoked', async () => {
    mocks.saveCommission.mockImplementation(() => reject(403));
    render(<AdminCommissionPage />);
    fireEvent.change(screen.getByLabelText(/Hoa hồng nền tảng \(%\)/), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hoa hồng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));
    await screen.findByText('Không có quyền truy cập');
    expect(screen.queryByLabelText(/Hoa hồng nền tảng \(%\)/)).toBeNull();
  });
  it('keeps category form open on duplicate/failure and only deactivates after explicit confirmation', async () => {
    render(<AdminCategoriesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo danh mục' }));
    fireEvent.change(screen.getByLabelText(/Tên danh mục/), { target: { value: 'Cultural' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu danh mục' }));
    await screen.findByText('Server rejected');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText(/Tên danh mục/) as HTMLInputElement).value).toBe('Cultural');
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vô hiệu hóa' }));
    expect(mocks.deactivate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(mocks.deactivate).toHaveBeenCalledWith('cat'));
    expect(screen.queryByText(/Đã cập nhật trạng thái/)).toBeNull();
  });
  it('preserves all typed policy params when saving text; raw HTML is displayed as text', async () => {
    mocks.savePolicy.mockReturnValue({ unwrap: () => Promise.resolve({ ...policy, content: 'New text' }) });
    const { container } = render(<AdminPoliciesPage />);
    expect(container.querySelector('script')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa chính sách hủy' }));
    fireEvent.change(screen.getByLabelText('Nội dung chính sách'), { target: { value: 'New text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chính sách' }));
    await waitFor(() => expect(mocks.savePolicy).toHaveBeenCalledWith({ key: 'cancellation', body: { title: policy.title, content: 'New text', params: policy.params } }));
    await screen.findByText('Đã lưu chính sách hủy.');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('refuses negative cancellation hours before calling API', () => {
    render(<AdminPoliciesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa chính sách hủy' }));
    fireEvent.change(screen.getByLabelText('Thời hạn hủy (giờ)'), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chính sách' }));
    expect(screen.getByText('Thời hạn hủy phải là số giờ không âm.')).toBeTruthy();
    expect(mocks.savePolicy).not.toHaveBeenCalled();
  });
  it('shows role defaults separately, preserves empty extra list and keeps access draft on backend failure', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Phân quyền Target User' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'audit:view (Super Admin)' }));
    fireEvent.change(screen.getByLabelText('Vai trò'), { target: { value: 'MODERATOR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại thay đổi' }));
    expect(mocks.access).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận phân quyền' }));
    await waitFor(() => expect(mocks.access).toHaveBeenCalledWith({ id: 'target', role: 'MODERATOR', extraPermissions: [] }));
    await screen.findByText('Server rejected');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/Đã lưu quyền cho/)).toBeNull();
  });
  it('disables changing the acting admin and resets users pagination when filters change', () => {
    mocks.users.mockReturnValue(query({ items: [{ ...user, id: 'admin' }], meta: { ...meta, total: 20, totalPages: 2 } }));
    render(<AdminUsersPage />);
    expect((screen.getByRole('button', { name: 'Tài khoản của bạn' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(mocks.users.mock.calls.at(-1)![0].page).toBe(2);
    fireEvent.change(screen.getByLabelText('Lọc vai trò'), { target: { value: 'MODERATOR' } });
    expect(mocks.users.mock.calls.at(-1)![0]).toMatchObject({ page: 1, role: 'MODERATOR' });
  });
  it('loads promotion details, locks redeemed discount and reports update failure without closing draft', async () => {
    render(<AdminPromotionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa PLATFORM10' }));
    await screen.findByRole('dialog');
    expect(mocks.detail).toHaveBeenCalledWith('promo', false);
    expect((screen.getByLabelText(/Mức giảm \(%\)/) as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Updated promo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByText('Server rejected');
    expect(mocks.updatePromotion).toHaveBeenCalledWith({ id: 'promo', patch: { title: 'Updated promo' } });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
