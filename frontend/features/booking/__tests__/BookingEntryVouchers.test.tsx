import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BookingEntryPage } from '../components/BookingEntryPage';
vi.mock('@/features/premium/api', () => ({usePremiumVouchersQuery:() => ({currentData:[],refetch:vi.fn()})}));

const mockPush = vi.fn();
const mockParams = new URLSearchParams('tourId=tour-1&departureId=dep-1&participants=2');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockParams,
}));

vi.mock('@/store/hooks', () => ({
  useAppSelector: () => ({ id: 'u1', fullName: 'Nguyen Van A', phone: '0912345678' }),
}));

const mockTour = {
  id: 'tour-1',
  agencyId: 'agency-123',
  title: 'Hành trình di sản miền Trung',
  departures: [
    {
      id: 'dep-1',
      date: new Date(Date.now() + 86400000 * 5).toISOString(),
      price: 1500000,
      isOpen: true,
      remaining: 10,
    },
  ],
};

const mockMyVouchers = [
  {
    id: 'v-agency',
    isUsed: false,
    promotion: {
      id: 'p-agency',
      scope: 'AGENCY',
      ownerId: 'agency-123',
      title: 'Voucher đại lý 10%',
      code: 'AGENCY10',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderAmount: 0,
      startsAt: new Date(Date.now() - 10000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
      targetTourIds: [],
    },
  },
  {
    id: 'v-other-agency',
    isUsed: false,
    promotion: {
      id: 'p-other',
      scope: 'AGENCY',
      ownerId: 'different-agency',
      title: 'Voucher đại lý khác',
      code: 'OTHER50',
      discountType: 'PERCENT',
      discountValue: 50,
      minOrderAmount: 0,
      startsAt: new Date(Date.now() - 10000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
      targetTourIds: [],
    },
  },
  {
    id: 'v-platform',
    isUsed: false,
    promotion: {
      id: 'p-platform',
      scope: 'PLATFORM',
      title: 'Voucher toàn sàn 50k',
      code: 'PLATFORM50',
      discountType: 'FIXED',
      discountValue: 50000,
      minOrderAmount: 0,
      startsAt: new Date(Date.now() - 10000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
      targetTourIds: [],
    },
  },
];

const mockPreviewPromotion = vi.fn();

vi.mock('@/features/tours', () => ({
  useGetTourQuery: () => ({ data: mockTour, isLoading: false, isError: false }),
}));

vi.mock('../api/bookingApi', () => ({
  useGetAvailablePromotionsQuery: () => ({ data: { platform: [], agency: [] } }),
  useGetMyVouchersQuery: () => ({ data: mockMyVouchers }),
  useCreateBookingMutation: () => [vi.fn(), { isLoading: false }],
  useLazyPreviewPromotionQuery: () => [
    mockPreviewPromotion,
    { isFetching: false },
  ],
}));

describe('BookingEntryPage Shopee-style Voucher Selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders compact Shopee voucher trigger bar and opens modal on click', () => {
    render(<BookingEntryPage />);

    // Compact voucher bar is visible
    expect(screen.getByText('Tripin Voucher')).toBeDefined();
    const triggerBtn = screen.getByText('Chọn hoặc nhập mã');
    expect(triggerBtn).toBeDefined();

    // Click to open Shopee-style voucher selector modal
    fireEvent.click(triggerBtn);

    // Modal opens with Shopee title & sections
    expect(screen.getByText('Chọn Tripin Voucher')).toBeDefined();
    expect(screen.getByText('Voucher đối tác trong ví của bạn:')).toBeDefined();
    expect(screen.getByText('Voucher đại lý 10%')).toBeDefined();

    // Agency voucher from another agency is filtered out
    expect(screen.queryByText('Voucher đại lý khác')).toBeNull();

    // Platform voucher section
    expect(screen.getByText('Voucher toàn sàn trong ví của bạn:')).toBeDefined();
    expect(screen.getByText('Voucher toàn sàn 50k')).toBeDefined();
  });

  it('applies agency voucher when clicked inside modal', async () => {
    mockPreviewPromotion.mockReturnValue({
      unwrap: vi.fn(async () => ({
        promotionId: 'p-agency',
        scope: 'AGENCY',
        discountAmount: 300000,
        finalAmount: 2700000,
      })),
    });

    render(<BookingEntryPage />);

    // Open modal
    fireEvent.click(screen.getByText('Chọn hoặc nhập mã'));

    // Select agency voucher
    const agencyVoucherCard = screen.getByText('Voucher đại lý 10%');
    fireEvent.click(agencyVoucherCard);

    await waitFor(() => {
      expect(mockPreviewPromotion).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AGENCY10', tourId: 'tour-1' })
      );
    });

    // Applied agency voucher shows on the page
    expect(screen.getByText('AGENCY10')).toBeDefined();
  });

  it('applies platform voucher when clicked inside modal', async () => {
    mockPreviewPromotion.mockReturnValue({
      unwrap: vi.fn(async () => ({
        promotionId: 'p-platform',
        scope: 'PLATFORM',
        discountAmount: 50000,
        finalAmount: 2950000,
      })),
    });

    render(<BookingEntryPage />);

    // Open modal
    fireEvent.click(screen.getByText('Chọn hoặc nhập mã'));

    // Select platform voucher
    const platformVoucherCard = screen.getByText('Voucher toàn sàn 50k');
    fireEvent.click(platformVoucherCard);

    await waitFor(() => {
      expect(mockPreviewPromotion).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'PLATFORM50', tourId: 'tour-1' })
      );
    });

    // Applied platform voucher shows on the page
    expect(screen.getByText('PLATFORM50')).toBeDefined();
  });
});
