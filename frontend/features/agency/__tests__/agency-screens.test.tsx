import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgencyDashboardPage from '@/app/agency/page';
import { AgencyBookingDetailPage, AgencyBookingsPage } from '../AgencyBookingsPage';
import { AgencyGuidePanel } from '../AgencyTourOperations';
import { AgencyTourWorkspacePage } from '@/features/tours/components/AgencyTourWorkspacePage';
import type { TourDetail } from '@/features/tours/types';

const mocks = vi.hoisted(() => ({
  permissions: ['agency:dashboard', 'agency:bookings-view', 'tour:update-own', 'tour:assign-guide', 'agency:export-customers'],
  dashboard: vi.fn(), bookings: vi.fn(), booking: vi.fn(), tour: vi.fn(), guides: vi.fn(), assign: vi.fn(), mutation: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/agency', useSearchParams: () => new URLSearchParams(), useParams: () => ({ id: 'tour-1' }) }));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => ({ permissions: mocks.permissions }), useAppDispatch: () => vi.fn() }));
vi.mock('@/features/tours/api/toursApi', async (original) => ({
  ...await original<typeof import('@/features/tours/api/toursApi')>(),
  useGetAgencyDashboardQuery: mocks.dashboard, useGetAgencyToursQuery: () => ({ data: { items: [], meta: { totalPages: 1 } } }),
  useGetAgencyTourQuery: mocks.tour, useGetAgencyGuidesQuery: mocks.guides,
  useAssignAgencyTourGuideMutation: () => [mocks.assign, {}],
  useSetAgencyTourItineraryMutation: () => [mocks.mutation, {}], useSetAgencyTourAvailabilityMutation: () => [mocks.mutation, {}],
  useSubmitAgencyTourMutation: () => [mocks.mutation, {}], useDeleteAgencyTourMutation: () => [mocks.mutation, {}],
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
  mocks.permissions = ['agency:dashboard', 'agency:bookings-view', 'tour:update-own', 'tour:assign-guide', 'agency:export-customers'];
  mocks.guides.mockReturnValue({ data: { items: [{ id: 'guide-1', fullName: 'Nguyễn An', languages: ['Vietnamese'] }], meta: { totalPages: 1 } } });
  mocks.tour.mockReturnValue({ currentData: tour, refetch: vi.fn() });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Agency operation screens', () => {
  it('shows a green bordered tour-list button and Vietnamese copy while awaiting review', () => {
    mocks.tour.mockReturnValue({ currentData: { ...tour, status: 'PENDING_REVIEW' }, refetch: vi.fn() });
    render(<AgencyTourWorkspacePage />);
    const back = screen.getByRole('link', { name: 'Danh sách tour' });
    expect(back.getAttribute('href')).toBe('/agency/tours');
    expect(back.className).toContain('border-primary');
    expect(back.className).toContain('text-white');
    expect(screen.getByText(/Tour đang chờ xét duyệt/).textContent).not.toMatch(/itinerary|availability/i);
    expect(screen.getByRole('button', { name: 'Lưu lịch trình' }).hasAttribute('disabled')).toBe(true);
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
    fireEvent.change(screen.getByLabelText('Chọn hướng dẫn viên'), { target: { value: 'guide-1' } });
    fireEvent.change(screen.getByLabelText('Phí mỗi đơn đặt chỗ (VND)'), { target: { value: '450000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phân công' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Tour đã thay đổi'));
    expect((screen.getByLabelText('Chọn hướng dẫn viên') as HTMLSelectElement).value).toBe('guide-1');
    expect((screen.getByLabelText('Phí mỗi đơn đặt chỗ (VND)') as HTMLInputElement).value).toBe('450000');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('preserves unsaved itinerary and availability across guide polling refreshes', async () => {
    const view = render(<AgencyTourWorkspacePage />);
    const title = await screen.findByLabelText('Tiêu đề ngày 1');
    fireEvent.change(title, { target: { value: 'Nội dung chưa lưu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bước 2: Khởi hành' }));
    fireEvent.change(screen.getByLabelText('Sức chứa'), { target: { value: '14' } });
    mocks.tour.mockReturnValue({ currentData: { ...tour, guideAssignment: { guideId: 'guide-1', status: 'ACCEPTED', feePerBooking: 100000 } }, refetch: vi.fn() });
    view.rerender(<AgencyTourWorkspacePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Bước 1: Lịch trình' }));
    expect((screen.getByLabelText('Tiêu đề ngày 1') as HTMLInputElement).value).toBe('Nội dung chưa lưu');
    expect((screen.getByLabelText('Sức chứa') as HTMLInputElement).value).toBe('14');
    fireEvent.click(screen.getByRole('button', { name: 'Bước 3: Hướng dẫn viên' }));
    expect(screen.getByText(/Hướng dẫn viên đã nhận tour/)).toBeTruthy();
  });
});
