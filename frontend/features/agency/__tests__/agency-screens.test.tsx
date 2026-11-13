import { selectFormValue } from '@/test/select';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgencyDashboardPage from '@/app/agency/page';
import { AgencyBookingDetailPage, AgencyBookingsPage } from '../AgencyBookingsPage';
import { AgencyGuidePanel } from '../AgencyTourOperations';
import { AgencyTourWorkspacePage } from '@/features/tours/components/AgencyTourWorkspacePage';
import type { TourDetail } from '@/features/tours/types';

const mocks = vi.hoisted(() => ({
  permissions: ['agency:dashboard', 'agency:bookings-view', 'tour:update-own', 'tour:configure-itinerary', 'tour:set-availability', 'tour:assign-guide', 'agency:export-customers'],
  dashboard: vi.fn(), bookings: vi.fn(), booking: vi.fn(), tour: vi.fn(), tourList: vi.fn(), guides: vi.fn(), assign: vi.fn(), mutation: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/agency', useSearchParams: () => new URLSearchParams(), useParams: () => ({ id: 'tour-1' }) }));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => ({ permissions: mocks.permissions }), useAppDispatch: () => vi.fn() }));
vi.mock('@/features/tours/api/toursApi', async (original) => ({
  ...await original<typeof import('@/features/tours/api/toursApi')>(),
  useGetAgencyDashboardQuery: mocks.dashboard, useGetAgencyToursQuery: mocks.tourList,
  useGetAgencyTourQuery: mocks.tour, useGetAgencyGuidesQuery: mocks.guides,
  useAssignAgencyTourGuideMutation: () => [mocks.assign, {}],
  useSetAgencyTourItineraryMutation: () => [mocks.mutation, {}], useSetAgencyTourAvailabilityMutation: () => [mocks.mutation, {}],
  useSubmitAgencyTourMutation: () => [mocks.mutation, {}], useDeleteAgencyTourMutation: () => [mocks.mutation, {}],
  useRestoreAgencyTourMutation: () => [mocks.mutation, {}],
}));
vi.mock('@/features/booking/api/bookingApi', () => ({
  useGetAgencyBookingsQuery: mocks.bookings, useGetAgencyBookingQuery: mocks.booking, useDownloadAgencyCustomersMutation: () => [mocks.mutation, {}],
}));

const tour: TourDetail = {
  id: 'tour-1', title: 'Tour Hạ Long', destination: 'Quảng Ninh', durationDays: 2, basePrice: 1_000_000, status: 'DRAFT',
  itinerary: [{ day: 1, title: 'Lịch trình ban đầu', activities: [] }],
  departures: [{ id: 'dep-1', date: '2026-12-01T00:00:00Z', capacity: 10, remaining: 10, price: 1_000_000, isOpen: true }],
  images: [], inclusions: [], exclusions: [], categories: [], categoryIds: [], ratingAvg: 0, ratingCount: 0,
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  mocks.permissions = ['agency:dashboard', 'agency:bookings-view', 'tour:update-own', 'tour:configure-itinerary', 'tour:set-availability', 'tour:assign-guide', 'agency:export-customers'];
  mocks.guides.mockReturnValue({ data: { items: [{ id: 'guide-1', fullName: 'Nguyễn An', languages: ['Vietnamese'] }], meta: { totalPages: 1 } } });
  mocks.tour.mockReturnValue({ currentData: tour, refetch: vi.fn() });
  mocks.tourList.mockReturnValue({ currentData: { items: [], meta: { totalPages: 1 } }, refetch: vi.fn() });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Agency operation screens', () => {
  it('opens tour details in read mode and exposes section-specific actions', () => {
    render(<AgencyTourWorkspacePage />);
    expect(screen.getByRole('heading', { name: 'Thông tin tour' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Ngày 1: Lịch trình ban đầu' })).toBeDefined();
    expect(screen.queryByLabelText('Tiêu đề ngày 1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sửa lịch trình' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Quản lý khởi hành & giá vé' })).toBeDefined();
  });

  it('keeps a staff member able to edit the itinerary but unable to manage departures', () => {
    mocks.permissions = ['tour:update-own', 'tour:configure-itinerary'];
    render(<AgencyTourWorkspacePage />);
    expect(screen.getByRole('button', { name: 'Sửa lịch trình' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Quản lý khởi hành & giá vé' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa lịch trình' }));
    expect(screen.getByLabelText('Tiêu đề ngày 1')).toBeDefined();
  });

  it('uses a raised departure card and only enables saving after a change', () => {
    render(<AgencyTourWorkspacePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Quản lý khởi hành & giá vé' }));
    const save = screen.getByRole('button', { name: 'Lưu ngày khởi hành' });
    expect(save.hasAttribute('disabled')).toBe(true);
    const price = screen.getByRole('textbox', { name: /Giá riêng/ });
    expect(price.closest('fieldset')?.className).toContain('shadow-');
    fireEvent.change(price, { target: { value: '1.200.000' } });
    expect(save.hasAttribute('disabled')).toBe(false);
  });

  it('sends only fields accepted by the availability API', async () => {
    mocks.mutation.mockReturnValue({ unwrap: () => new Promise(() => {}) });
    render(<AgencyTourWorkspacePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Quản lý khởi hành & giá vé' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Giá riêng/ }), { target: { value: '1.200.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ngày khởi hành' }));
    await waitFor(() => expect(mocks.mutation).toHaveBeenCalled());
    expect(mocks.mutation.mock.calls[0][0].departures).toEqual([{
      id: 'dep-1', date: '2026-12-01T00:00:00.000Z', capacity: 10,
      isOpen: true, priceOverride: 1_200_000,
    }]);
  });

  it('keeps an unsaved itinerary when leaving edit mode is cancelled', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AgencyTourWorkspacePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa lịch trình' }));
    fireEvent.change(screen.getByLabelText('Tiêu đề ngày 1'), { target: { value: 'Bản sửa chưa lưu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chế độ sửa' }));
    expect(confirm).toHaveBeenCalled();
    expect((screen.getByLabelText('Tiêu đề ngày 1') as HTMLInputElement).value).toBe('Bản sửa chưa lưu');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chế độ sửa' }));
    expect(screen.queryByLabelText('Tiêu đề ngày 1')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ngày 1: Lịch trình ban đầu' })).toBeDefined();
  });

  it('shows a green bordered tour-list button and Vietnamese copy while awaiting review', () => {
    mocks.tour.mockReturnValue({ currentData: { ...tour, status: 'PENDING_REVIEW' }, refetch: vi.fn() });
    render(<AgencyTourWorkspacePage />);
    const back = screen.getByRole('link', { name: 'Danh sách tour' });
    expect(back.getAttribute('href')).toBe('/agency/tours');
    expect(back.className).toContain('border-primary');
    expect(back.className).toContain('text-white');
    expect(screen.getByText(/Tour đang chờ xét duyệt/).textContent).not.toMatch(/itinerary|availability/i);
    expect(screen.queryByRole('button', { name: 'Sửa lịch trình' })).toBeNull();
    expect(screen.getByText(/Tour đang chờ duyệt nên chưa thể sửa lịch trình/)).toBeDefined();
  });
  it('keeps lifetime metrics unchanged when filtering the bento revenue chart and never invents growth', () => {
    mocks.dashboard.mockReturnValue({ data: {
      generatedAt: '2026-10-16T05:00:00Z', tours: { total: 2, byStatus: {} }, bookings: { CONFIRMED: 3 },
      revenue: { gross: 1000, commission: 100, net: 900, bookings: 3 },
      customers: 2,
      last30Days: [{ date: '2026-09-20', bookings: 1, net: 200 }, { date: '2026-10-15', bookings: 2, net: 300 }],
      last6Months: [{ month: '2026-05', bookings: 1, net: 400 }, { month: '2026-10', bookings: 2, net: 500 }],
      topTours: [{ tourId: 'tour-1', title: 'Tour Hạ Long', coverImage: 'https://example.com/halong.jpg', bookings: 3, net: 900 }], openComplaints: 0,
    }, refetch: vi.fn() });
    render(<AgencyDashboardPage />);
    const chart = within(screen.getByRole('region', { name: 'Biểu đồ doanh thu' }));
    expect(chart.getByText('500 ₫')).toBeDefined();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Khoảng thời gian doanh thu' }));
    fireEvent.click(screen.getByText('7 ngày gần đây'));
    expect(chart.getByText('300 ₫', { selector: 'p' })).toBeDefined();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Khoảng thời gian doanh thu' }));
    fireEvent.click(screen.getByText('6 tháng gần đây'));
    expect(chart.getByText('900 ₫', { selector: 'p' })).toBeDefined();
    expect(chart.getByRole('img', { name: /theo tháng/ })).toBeDefined();
    fireEvent.error(screen.getByAltText('Ảnh tour Tour Hạ Long'));
    expect(screen.getByLabelText('Tour chưa có ảnh đại diện')).toBeDefined();
    const overview = within(screen.getByRole('region', { name: 'Số liệu tổng quan' }));
    expect(overview.getByText('900 ₫')).toBeDefined();
    expect(overview.getByRole('heading', { name: 'Khách hàng' })).toBeDefined();
    expect(overview.getByText('2')).toBeDefined();
    expect(screen.getByText('01/05/2026 – 16/10/2026')).toBeDefined();
    expect(screen.getByRole('main').textContent).not.toMatch(/Dashboard|Agency|Booking|Best selling|Total profit|Views/);
    expect(screen.queryByText(/so với tháng trước/)).toBeNull();
    expect(screen.getByRole('region', { name: 'Tour bán chạy' })).toBeDefined();
  });

  it('renders a real zero state rather than fabricated revenue bars', () => {
    mocks.dashboard.mockReturnValue({ data: { generatedAt: '2026-10-16T05:00:00Z', tours: { total: 0, byStatus: {} }, bookings: {}, revenue: { gross: 0, commission: 0, net: 0, bookings: 0 }, last30Days: [], topTours: [], openComplaints: 0 }, refetch: vi.fn() });
    render(<AgencyDashboardPage />);
    expect(screen.getByText('Chưa có doanh thu')).toBeDefined();
    expect(screen.queryByRole('img', { name: /Biểu đồ doanh thu/ })).toBeNull();
  });
  it('shows a dashboard failure without inventing zero revenue or empty-tour claims', () => {
    mocks.dashboard.mockReturnValue({ error: { status: 500 }, refetch: vi.fn() });
    render(<AgencyDashboardPage />);
    expect(screen.getByRole('alert').textContent).toContain('Không tải được tổng quan');
    expect(screen.queryByText('0 ₫')).toBeNull();
    expect(screen.queryByText('Chưa có tour phát sinh doanh thu.')).toBeNull();
  });

  it('keeps the last dashboard snapshot visible when a background refresh fails', () => {
    mocks.dashboard.mockReturnValue({
      data: {
        generatedAt: '2026-10-16T05:00:00Z', tours: { total: 1, byStatus: { APPROVED: 1 } },
        bookings: { CONFIRMED: 2 }, revenue: { gross: 1000, commission: 100, net: 900, bookings: 2 },
        customers: 2, last30Days: [], topTours: [], openComplaints: 0,
      },
      error: { status: 500 }, isLoading: false, isFetching: false, refetch: vi.fn(),
    });
    render(<AgencyDashboardPage />);
    expect(screen.getByRole('alert').textContent).toContain('Đang hiển thị số liệu lần gần nhất');
    expect(within(screen.getByRole('region', { name: 'Số liệu tổng quan' })).getByText('900 ₫')).toBeDefined();
    expect(screen.getByText(/Cập nhật \d{2}:\d{2}/)).toBeDefined();
  });

  it('keeps dashboard metrics usable while a background refresh is pending', () => {
    mocks.dashboard.mockReturnValue({
      data: {
        generatedAt: '2026-10-16T05:00:00Z', tours: { total: 0, byStatus: {} },
        bookings: {}, revenue: { gross: 1000, commission: 100, net: 900, bookings: 0 },
        customers: 0, last30Days: [], topTours: [], openComplaints: 0,
      },
      isLoading: false, isFetching: true, refetch: vi.fn(),
    });
    render(<AgencyDashboardPage />);
    expect(within(screen.getByRole('region', { name: 'Số liệu tổng quan' })).getByText('900 ₫')).toBeDefined();
    expect(screen.queryByText('Đang tải tổng quan…')).toBeNull();
    expect(screen.getByLabelText('Số liệu tổng quan').parentElement?.getAttribute('aria-busy')).toBe('true');
  });

  it('loads tours only after opening the Booking filter, using a 12-item cache-compatible page', () => {
    mocks.bookings.mockReturnValue({ currentData: { items: [], meta: { page: 1, totalPages: 1, total: 0 } }, refetch: vi.fn() });
    render(<AgencyBookingsPage />);
    expect(mocks.tourList.mock.lastCall?.[0]).toEqual({ page: 1, limit: 12 });
    expect(mocks.tourList.mock.lastCall?.[1]).toMatchObject({ skip: true });
    fireEvent.keyDown(screen.getAllByRole('combobox')[1], { key: 'ArrowDown', keyCode: 40 });
    expect(mocks.tourList.mock.lastCall?.[1]).toMatchObject({ skip: false });
  });

  it('paginates beyond 100 tours and searches the complete Agency list on the server', async () => {
    mocks.bookings.mockReturnValue({ currentData: { items: [], meta: { page: 1, totalPages: 1, total: 0 } }, refetch: vi.fn() });
    mocks.tourList.mockReturnValue({ currentData: { items: [{ ...tour, id: 'tour-1' }], meta: { totalPages: 11 } }, refetch: vi.fn() });
    render(<AgencyBookingsPage />);
    fireEvent.keyDown(screen.getAllByRole('combobox')[1], { key: 'ArrowDown', keyCode: 40 });
    fireEvent.click(screen.getByRole('button', { name: 'Sau →' }));
    expect(mocks.tourList.mock.lastCall?.[0]).toEqual({ page: 2, limit: 12 });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm tour theo tên' }), { target: { value: 'Hạ Long' } });
    await waitFor(() => expect(mocks.tourList.mock.lastCall?.[0]).toEqual({ page: 1, limit: 12, q: 'Hạ Long' }));
  });

  it('does not request bookings without the required permission', () => {
    mocks.permissions = [];
    mocks.bookings.mockReturnValue({});
    render(<AgencyBookingsPage />);
    expect(mocks.bookings.mock.calls[0]?.[1]).toHaveProperty('skip', true);
    expect(screen.getByRole('alert').textContent).toContain('không có quyền');
  });

  it('keeps restricted customer details absent when Agency DTO does not share them', () => {
    mocks.booking.mockReturnValue({ data: { id: 'booking-1', bookingCode: 'TRP-1234', status: 'PENDING', isPaid: false, tour: { id: 'tour-1', title: 'Tour Hạ Long' }, departureDate: '2026-12-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', participants: 2, totalAmount: 2_000_000, commissionAmount: 200_000, agencyAmount: 1_800_000 } });
    render(<AgencyBookingDetailPage id="booking-1" />);
    expect(screen.getByText(/Thông tin liên hệ chỉ được chia sẻ/)).toBeTruthy();
    expect(screen.queryByText('Điện thoại')).toBeNull();
    expect(screen.queryByText('Ghi chú')).toBeNull();
  });

  it('keeps guide selection and fee when the server rejects an assignment, without reporting success', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.assign.mockReturnValue({ unwrap: () => Promise.reject({ data: { error: { code: 'CONCURRENT_UPDATE', message: 'Tour đã thay đổi, hãy tải lại.' } } }) });
    render(<AgencyGuidePanel tour={tour} />);
    await selectFormValue(/Chọn hướng dẫn viên/, 'guide-1');
    fireEvent.change(screen.getByLabelText('Phí mỗi đơn đặt chỗ (VND)'), { target: { value: '450000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phân công' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Tour đã được cập nhật ở phiên khác'));
    expect(screen.getByText(/Nguyễn An/, { selector: '.ant-select-content' })).toBeTruthy();
    expect((screen.getByLabelText('Phí mỗi đơn đặt chỗ (VND)') as HTMLInputElement).value).toBe('450.000');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('preserves unsaved itinerary and availability across guide polling refreshes', async () => {
    const view = render(<AgencyTourWorkspacePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa lịch trình' }));
    const title = await screen.findByLabelText('Tiêu đề ngày 1');
    fireEvent.change(title, { target: { value: 'Nội dung chưa lưu' } });
    mocks.tour.mockReturnValue({ currentData: { ...tour, guideAssignment: { guideId: 'guide-1', status: 'ACCEPTED', feePerBooking: 100000 } }, refetch: vi.fn() });
    view.rerender(<AgencyTourWorkspacePage />);
    expect((screen.getByLabelText('Tiêu đề ngày 1') as HTMLInputElement).value).toBe('Nội dung chưa lưu');
  });
});
