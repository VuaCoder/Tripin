import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PremiumVoucherCard, VoucherCard } from '../components/VoucherCard';
import { TravelerAccountNav } from '../components/TravelerAccountNav';
vi.mock('next/navigation', () => ({ usePathname: () => '/settings/vouchers' }));
vi.mock('@/features/premium/PremiumWalletSection',() => ({PremiumWalletSection:() => null}));
import type { UserVoucherItem } from '../api/voucherWalletApi';
import type { PremiumVoucher } from '@/features/premium/api';

vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
      createElement('a', { href, className }, children as never),
  };
});

const mockGetMyVouchersQuery = vi.fn();
const mockCollectVoucherMutation = vi.fn();
vi.mock('../api/voucherWalletApi', async () => {
  const actual = await vi.importActual<any>('../api/voucherWalletApi');
  return {
    ...actual,
    useGetMyVouchersQuery: () => mockGetMyVouchersQuery(),
    useCollectVoucherMutation: () => [mockCollectVoucherMutation(), { isLoading: false }],
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const sampleVoucher = (overrides: Partial<UserVoucherItem> = {}): UserVoucherItem => ({
  id: 'uv-1',
  userId: 'user-1',
  promotionId: 'p-1',
  collectedAt: new Date().toISOString(),
  isUsed: false,
  promotion: {
    id: 'p-1',
    scope: 'PLATFORM',
    applyType: 'COLLECTABLE',
    codeType: 'SHARED',
    code: 'DISCOUNT20',
    title: 'Khuyến mãi mùa hè 2026',
    discountType: 'PERCENT',
    discountValue: 20,
    maxDiscountAmount: 200000,
    minOrderAmount: 1000000,
    firstBookingOnly: false,
    targetTourIds: [],
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    usageLimitPerUser: 1,
    usedCount: 0,
    isActive: true,
    isRunning: true,
  },
  ...overrides,
});

describe('VoucherCard', () => {
  it('renders discount value, title, and code correctly', () => {
    const voucher = sampleVoucher();
    render(<VoucherCard voucher={voucher} />);

    expect(screen.getByText('20%')).toBeDefined();
    expect(screen.getByText('Khuyến mãi mùa hè 2026')).toBeDefined();
    expect(screen.getByText('DISCOUNT20')).toBeDefined();
    expect(screen.getByText(/Đơn tối thiểu 1.000.000 ₫/)).toBeDefined();
    expect(screen.getByText('Dùng ngay')).toBeDefined();
  });

  it('displays urgent warning when voucher expires within 3 hours', () => {
    const voucher = sampleVoucher({
      promotion: {
        ...sampleVoucher().promotion!,
        endsAt: new Date(Date.now() + 2 * 3600000).toISOString(), // 2 hours remaining
      },
    });
    render(<VoucherCard voucher={voucher} />);

    expect(screen.getByText(/Sắp hết hạn: còn/)).toBeDefined();
  });

  it('displays used badge for redeemed voucher', () => {
    const voucher = sampleVoucher({
      isUsed: true,
      usedAt: new Date().toISOString(),
    });
    render(<VoucherCard voucher={voucher} />);

    expect(screen.getByText('Đã sử dụng')).toBeDefined();
    expect(screen.queryByText('Dùng ngay')).toBeNull();
  });
});

const samplePremiumVoucher = (overrides: Partial<PremiumVoucher> = {}): PremiumVoucher => ({
  id: 'premium-voucher-1',
  terms: {
    title: 'Voucher Premium Nha Trang – Đà Lạt',
    agencyId: 'agency-1',
    tourIds: ['tour-1'],
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscountAmount: 150000,
    minOrderAmount: 500000,
  },
  startsAt: new Date(Date.now() - 86400000).toISOString(),
  endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  bookingId: null,
  heldAt: null,
  ...overrides,
});

describe('PremiumVoucherCard', () => {
  it('uses the same ticket layout as normal vouchers, with a gold theme and correct tour link', () => {
    const { container } = render(<PremiumVoucherCard voucher={samplePremiumVoucher()} />);
    expect(screen.getByText('10%')).toBeDefined();
    expect(screen.getByText('Premium')).toBeDefined();
    expect(screen.getByText('Voucher Premium Nha Trang – Đà Lạt')).toBeDefined();
    expect(screen.getByText(/Đơn tối thiểu 500.000 ₫ • Tối đa 150.000 ₫/)).toBeDefined();
    expect(screen.getByText(/HSD:/)).toBeDefined();
    expect(container.firstElementChild?.className).toContain('sm:flex-row');
    expect(container.firstElementChild?.className).toContain('border-amber-300');
    expect(screen.getByRole('link', { name: 'Dùng ngay' }).getAttribute('href')).toBe('/tours/tour-1');
    expect(screen.queryByRole('button', { name: /Sao chép/ })).toBeNull();
    const details = screen.getByRole('button', { name: 'Điều kiện' });
    expect(details.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(details);
    expect(details.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Không dùng chung với mã giảm giá khác.')).toBeDefined();
  });

  it.each([
    [{ bookingId: 'booking-1', heldAt: null }, 'Đã dùng / đang giữ cho đơn'],
    [{ heldAt: new Date().toISOString() }, 'Đang xử lý đặt tour'],
    [{ endsAt: new Date(Date.now() - 86400000).toISOString() }, 'Hết hạn'],
    [{ startsAt: new Date(Date.now() + 86400000).toISOString() }, 'Chưa đến hạn sử dụng'],
  ] as const)('does not offer reuse for unavailable vouchers: %s', (overrides, label) => {
    render(<PremiumVoucherCard voucher={samplePremiumVoucher(overrides)} />);
    expect(screen.getByText(label)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Dùng ngay' })).toBeNull();
  });

  it('does not link to an undefined tour when tour IDs are empty', () => {
    const voucher = samplePremiumVoucher();
    voucher.terms.tourIds = [];
    render(<PremiumVoucherCard voucher={voucher} />);
    expect(screen.queryByRole('link', { name: 'Dùng ngay' })).toBeNull();
  });

  it('shows fixed discounts without adding a percent sign', () => {
    const voucher = samplePremiumVoucher();
    voucher.terms.discountType = 'FIXED';
    voucher.terms.discountValue = 100000;
    render(<PremiumVoucherCard voucher={voucher} />);
    expect(screen.getByText('100K')).toBeDefined();
    expect(screen.queryByText('100000%')).toBeNull();
  });
});

describe('VoucherWalletPage', () => {
  it('uses the same short wallet name in account navigation', () => {
    render(<TravelerAccountNav />);
    expect(screen.getByRole('link', { name: 'Ví voucher' }).getAttribute('href')).toBe('/settings/vouchers');
    expect(screen.queryByText('Ví voucher & Ưu đãi')).toBeNull();
  });
  it('renders clean wallet interface without displaying reminder banner or setup buttons', async () => {
    mockGetMyVouchersQuery.mockReturnValue({ data: { data: [] }, isLoading: false, refetch: vi.fn() });
    mockCollectVoucherMutation.mockReturnValue(vi.fn());
    const { VoucherWalletPage } = await import('../components/VoucherWalletPage');
    render(<VoucherWalletPage />);

    expect(screen.getByRole('heading', { name: 'Ví voucher' })).toBeDefined();
    expect(screen.queryByText('Ví voucher & Ưu đãi')).toBeNull();
    expect(screen.getByText('Khả dụng')).toBeDefined();
    expect(screen.getByText('Đã sử dụng')).toBeDefined();
    expect(screen.getByText('Hết hạn')).toBeDefined();

    // Verify reminder banner and setup buttons are not shown on UI (reminders run silently in background)
    expect(screen.queryByText('Hệ thống nhắc nhở thông minh')).toBeNull();
    expect(screen.queryByText(/Nghỉ trưa/)).toBeNull();
    expect(screen.queryByText(/Thay đổi giờ rảnh/)).toBeNull();
    expect(screen.queryByText(/Giờ rảnh & Cảnh báo/)).toBeNull();
  });
});

