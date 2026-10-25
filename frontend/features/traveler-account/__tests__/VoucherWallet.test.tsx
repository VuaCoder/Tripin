import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoucherCard } from '../components/VoucherCard';
vi.mock('@/features/premium/PremiumWalletSection',() => ({PremiumWalletSection:() => null}));
import type { UserVoucherItem } from '../api/voucherWalletApi';

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

describe('VoucherWalletPage', () => {
  it('renders clean wallet interface without displaying reminder banner or setup buttons', async () => {
    mockGetMyVouchersQuery.mockReturnValue({ data: { data: [] }, isLoading: false, refetch: vi.fn() });
    mockCollectVoucherMutation.mockReturnValue(vi.fn());
    const { VoucherWalletPage } = await import('../components/VoucherWalletPage');
    render(<VoucherWalletPage />);

    expect(screen.getByText('Ví voucher & Ưu đãi')).toBeDefined();
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

