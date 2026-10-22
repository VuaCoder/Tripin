import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgencyVouchersSection } from '../components/AgencyVouchersSection';
import { AgencyToursSection } from '../components/AgencyToursSection';

const mockUseGetAgencyPromotionsQuery = vi.fn();
const mockUseGetMyVouchersQuery = vi.fn();
const mockCollectVoucherMutation = vi.fn();
const mockUseGetToursQuery = vi.fn();
let mockAuthState = { isAuthenticated: true, role: 'TRAVELER' };

vi.mock('../api', () => ({
  useGetAgencyPromotionsQuery: (id: string) => mockUseGetAgencyPromotionsQuery(id),
}));

vi.mock('@/features/traveler-account/api/voucherWalletApi', () => ({
  useGetMyVouchersQuery: () => mockUseGetMyVouchersQuery(),
  useCollectVoucherMutation: () => [mockCollectVoucherMutation, { isLoading: false }],
}));

vi.mock('@/features/tours/api/toursApi', () => ({
  useGetToursQuery: (args: any) => mockUseGetToursQuery(args),
}));

vi.mock('@/store/hooks', () => ({
  useAppSelector: (selector: any) => selector({}),
}));

vi.mock('@/features/auth', () => ({
  selectIsAuthenticated: () => mockAuthState.isAuthenticated,
  selectRole: () => mockAuthState.role,
}));

vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
      createElement('a', { href, className }, children as never),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgencyVouchersSection', () => {
  const samplePromo = {
    id: 'p1',
    scope: 'AGENCY',
    ownerId: 'a1',
    applyType: 'COLLECTABLE',
    codeType: 'SHARED',
    title: 'Giảm giá 15% mùa hè',
    discountType: 'PERCENT',
    discountValue: 15,
    maxDiscountAmount: 200000,
    minOrderAmount: 1000000,
    startsAt: new Date(Date.now() - 10000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    usedCount: 0,
    usageLimitPerUser: 1,
    firstBookingOnly: false,
    targetTourIds: [],
    isActive: true,
    isRunning: true,
  };

  it('renders voucher list and allows traveler to collect voucher', async () => {
    mockAuthState = { isAuthenticated: true, role: 'TRAVELER' };
    mockUseGetAgencyPromotionsQuery.mockReturnValue({ data: [samplePromo], isLoading: false });
    mockUseGetMyVouchersQuery.mockReturnValue({ data: { data: [] } });
    mockCollectVoucherMutation.mockReturnValue({ unwrap: vi.fn(async () => ({})) });

    render(<AgencyVouchersSection agencyId="a1" agencyName="Du lịch Việt An" />);

    expect(screen.getByText('Ưu đãi độc quyền từ nhà cung cấp')).toBeDefined();
    expect(screen.getByText('Giảm giá 15% mùa hè')).toBeDefined();
    expect(screen.getByText('15%')).toBeDefined();

    const collectButton = screen.getByRole('button', { name: /\+ Lưu vào ví/i });
    expect(collectButton).toBeDefined();

    fireEvent.click(collectButton);
    expect(mockCollectVoucherMutation).toHaveBeenCalledWith({ promotionId: 'p1' });
  });

  it('displays "Đã lưu vào ví" when voucher is already in wallet', () => {
    mockAuthState = { isAuthenticated: true, role: 'TRAVELER' };
    mockUseGetAgencyPromotionsQuery.mockReturnValue({ data: [samplePromo], isLoading: false });
    mockUseGetMyVouchersQuery.mockReturnValue({
      data: { data: [{ id: 'v1', promotionId: 'p1', isUsed: false }] },
    });

    render(<AgencyVouchersSection agencyId="a1" agencyName="Du lịch Việt An" />);

    expect(screen.getByText('Đã lưu vào ví')).toBeDefined();
    expect(screen.queryByRole('button', { name: /\+ Lưu vào ví/i })).toBeNull();
  });

  it('links guests to /login when clicking to collect voucher', () => {
    mockAuthState = { isAuthenticated: false, role: null as any };
    mockUseGetAgencyPromotionsQuery.mockReturnValue({ data: [samplePromo], isLoading: false });
    mockUseGetMyVouchersQuery.mockReturnValue({ data: { data: [] } });

    render(<AgencyVouchersSection agencyId="a1" agencyName="Du lịch Việt An" />);

    const link = screen.getByRole('link', { name: /\+ Lưu vào ví/i });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('filters out UNIQUE_BATCH promotions and renders AUTO_APPLY badge', () => {
    mockAuthState = { isAuthenticated: true, role: 'TRAVELER' };
    const batchPromo = {
      ...samplePromo,
      id: 'batch-1',
      title: 'Lô mã riêng VIP',
      codeType: 'UNIQUE_BATCH',
      code: 'TEST',
    };
    const autoPromo = {
      ...samplePromo,
      id: 'auto-1',
      title: 'Tự động giảm 10k',
      applyType: 'AUTO_APPLY',
      codeType: 'SHARED',
      code: 'AUTO10',
    };
    const sharedPromo = {
      ...samplePromo,
      id: 'shared-1',
      title: 'Mã giảm hè',
      applyType: 'CODE',
      codeType: 'SHARED',
      code: 'SUMMER2026',
    };

    mockUseGetAgencyPromotionsQuery.mockReturnValue({
      data: [batchPromo, autoPromo, sharedPromo],
      isLoading: false,
    });
    mockUseGetMyVouchersQuery.mockReturnValue({ data: { data: [] } });

    render(<AgencyVouchersSection agencyId="a1" agencyName="Du lịch Việt An" />);

    // UNIQUE_BATCH promo should NOT be rendered
    expect(screen.queryByText('Lô mã riêng VIP')).toBeNull();
    expect(screen.queryByText('TEST')).toBeNull();

    // AUTO_APPLY should show "Tự động áp dụng" badge
    expect(screen.getByText('Tự động giảm 10k')).toBeDefined();
    expect(screen.getByText('Tự động áp dụng')).toBeDefined();

    // SHARED should show copy code button
    expect(screen.getByText('Mã giảm hè')).toBeDefined();
    expect(screen.getByText('SUMMER2026')).toBeDefined();
  });
});

describe('AgencyToursSection', () => {
  it('renders tour cards belonging to the agency', () => {
    mockUseGetToursQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'tour-1',
            title: 'Khám phá Vịnh Hạ Long',
            destination: 'Quảng Ninh',
            durationDays: 3,
            basePrice: 2500000,
            ratingAvg: 4.8,
            ratingCount: 12,
            coverImage: 'https://example.com/cover.jpg',
          },
        ],
        meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
      },
      isLoading: false,
    });

    render(<AgencyToursSection agencyId="a1" agencyName="Du lịch Việt An" />);

    expect(screen.getByText(/Các chuyến đi của Du lịch Việt An/)).toBeDefined();
    expect(screen.getByText('Khám phá Vịnh Hạ Long')).toBeDefined();
    expect(screen.getByText('Quảng Ninh')).toBeDefined();
    expect(screen.getByText(/2.500.000 ₫/)).toBeDefined();
    expect(screen.getByRole('link', { name: /Xem tour/i }).getAttribute('href')).toBe('/tours/tour-1');
  });

  it('renders empty state when agency has no active tours', () => {
    mockUseGetToursQuery.mockReturnValue({
      data: { items: [], meta: { page: 1, limit: 6, total: 0, totalPages: 1 } },
      isLoading: false,
    });

    render(<AgencyToursSection agencyId="a1" agencyName="Du lịch Việt An" />);

    expect(screen.getByText('Chưa có chuyến đi nào được đăng tải')).toBeDefined();
  });
});
