import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HotVouchersSection } from '../components/HotVouchersSection';
import type { PromotionDto, UserVoucherItem } from '@/features/traveler-account/api/voucherWalletApi';

const mocks = vi.hoisted(() => ({
  isAuthenticated: true,
  hotVouchers: [] as PromotionDto[],
  myVouchers: [] as UserVoucherItem[],
  collect: vi.fn(),
}));

vi.mock('@/store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { token: mocks.isAuthenticated ? 'token-abc' : null } }),
}));

vi.mock('@/features/auth', () => ({
  selectIsAuthenticated: (state: { auth: { token: string | null } }) => Boolean(state.auth.token),
}));

vi.mock('@/features/traveler-account/api/voucherWalletApi', () => ({
  useGetHotPromotionsQuery: () => ({
    data: { success: true, data: mocks.hotVouchers },
    isLoading: false,
  }),
  useGetMyVouchersQuery: () => ({
    data: { success: true, data: mocks.myVouchers },
    isLoading: false,
  }),
  useCollectVoucherMutation: () => [mocks.collect, { isLoading: false }],
}));

const sampleVouchers: PromotionDto[] = [
  {
    id: 'promo-1',
    scope: 'PLATFORM',
    applyType: 'COLLECTABLE',
    codeType: 'SHARED',
    code: 'GIAM10',
    title: 'Giảm 10% toàn sàn',
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscountAmount: 200000,
    minOrderAmount: 500000,
    firstBookingOnly: false,
    targetTourIds: [],
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    usageLimitPerUser: 1,
    usedCount: 0,
    isActive: true,
    isRunning: true,
  },
  {
    id: 'promo-2',
    scope: 'PLATFORM',
    applyType: 'COLLECTABLE',
    codeType: 'SHARED',
    code: 'GIAM50K',
    title: 'Giảm 50K cho đơn từ 300K',
    discountType: 'FIXED',
    discountValue: 50000,
    minOrderAmount: 300000,
    firstBookingOnly: false,
    targetTourIds: [],
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    usageLimitPerUser: 1,
    usedCount: 0,
    isActive: true,
    isRunning: true,
  },
  {
    id: 'promo-3',
    scope: 'AGENCY',
    applyType: 'COLLECTABLE',
    codeType: 'SHARED',
    code: 'HE2026',
    title: 'Ưu đãi hè rực rỡ',
    discountType: 'PERCENT',
    discountValue: 15,
    minOrderAmount: 1000000,
    firstBookingOnly: false,
    targetTourIds: [],
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    usageLimitPerUser: 1,
    usedCount: 0,
    isActive: true,
    isRunning: true,
  },
  {
    id: 'promo-4',
    scope: 'PLATFORM',
    applyType: 'COLLECTABLE',
    codeType: 'SHARED',
    code: 'VIP100',
    title: 'Ưu đãi đặc biệt 100K',
    discountType: 'FIXED',
    discountValue: 100000,
    minOrderAmount: 1500000,
    firstBookingOnly: false,
    targetTourIds: [],
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2026-12-31T23:59:59Z',
    usageLimitPerUser: 1,
    usedCount: 0,
    isActive: true,
    isRunning: true,
  },
];

describe('HotVouchersSection on Home page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated = true;
    mocks.hotVouchers = [...sampleVouchers];
    mocks.myVouchers = [];
    mocks.collect.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) });
  });

  afterEach(cleanup);

  it('filters out vouchers that are already collected in traveler wallet', () => {
    // User already collected promo-1
    mocks.myVouchers = [
      {
        id: 'user-v-1',
        userId: 'user-1',
        promotionId: 'promo-1',
        collectedAt: '2026-01-02T00:00:00Z',
        isUsed: false,
      },
    ];

    render(<HotVouchersSection />);

    // promo-1 should NOT appear
    expect(screen.queryByText('GIAM10')).toBeNull();
    expect(screen.queryByText('Giảm 10% toàn sàn')).toBeNull();

    // Remaining 3 vouchers should be visible
    expect(screen.getByText('GIAM50K')).toBeDefined();
    expect(screen.getByText('HE2026')).toBeDefined();
    expect(screen.getByText('VIP100')).toBeDefined();
  });

  it('adapts layout for exactly 1 voucher (left-aligned grid card)', () => {
    mocks.hotVouchers = [sampleVouchers[0]];
    const { container } = render(<HotVouchersSection />);

    expect(screen.getByText('GIAM10')).toBeDefined();
    expect(container.querySelector('.grid')).not.toBeNull();
  });

  it('adapts layout for exactly 2 vouchers (2-column grid)', () => {
    mocks.hotVouchers = [sampleVouchers[0], sampleVouchers[1]];
    const { container } = render(<HotVouchersSection />);

    expect(screen.getByText('GIAM10')).toBeDefined();
    expect(screen.getByText('GIAM50K')).toBeDefined();
    expect(container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')).not.toBeNull();
  });

  it('adapts layout for 3 vouchers (3-column grid)', () => {
    mocks.hotVouchers = [sampleVouchers[0], sampleVouchers[1], sampleVouchers[2]];
    const { container } = render(<HotVouchersSection />);

    expect(screen.getByText('GIAM10')).toBeDefined();
    expect(screen.getByText('GIAM50K')).toBeDefined();
    expect(screen.getByText('HE2026')).toBeDefined();
    expect(container.querySelector('.lg\\:grid-cols-3')).not.toBeNull();
  });

  it('adapts layout for 4+ vouchers (responsive 4-column grid)', () => {
    mocks.hotVouchers = [...sampleVouchers];
    const { container } = render(<HotVouchersSection />);

    expect(screen.getByText('VIP100')).toBeDefined();
    expect(container.querySelector('.xl\\:grid-cols-4')).not.toBeNull();
  });

  it('displays celebration banner when user has collected all available vouchers', () => {
    // User already collected all 4 vouchers
    mocks.myVouchers = sampleVouchers.map((p, i) => ({
      id: `v-${i}`,
      userId: 'user-1',
      promotionId: p.id,
      collectedAt: '2026-01-01T00:00:00Z',
      isUsed: false,
    }));

    render(<HotVouchersSection />);

    expect(screen.getByText(/Bạn đã thu thập toàn bộ voucher ưu đãi/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Xem Ví voucher/i }).getAttribute('href')).toBe('/settings/vouchers');
  });

  it('triggers floating + ticket animation and marks collected on click', async () => {
    mocks.hotVouchers = [sampleVouchers[0]];
    render(<HotVouchersSection />);

    const saveButton = screen.getByRole('button', { name: 'Lưu mã' });
    fireEvent.click(saveButton);

    expect(mocks.collect).toHaveBeenCalledWith({ promotionId: 'promo-1' });

    // Check button indicates saving / saved
    expect(screen.getByText('Đã lưu!')).toBeDefined();
  });
});
