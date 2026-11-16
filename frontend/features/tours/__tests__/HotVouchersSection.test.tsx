import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
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

  it.each([1, 2, 3, 4])('keeps %i vouchers in a locally scrollable row without a wallet shortcut', (count) => {
    mocks.hotVouchers = sampleVouchers.slice(0, count);
    render(<HotVouchersSection compact />);
    const region = screen.getByRole('region', { name: 'Danh sách mã ưu đãi' });
    expect(region.className).toContain('overflow-x-auto');
    expect(region.children.length).toBe(count);
    expect(screen.queryByText('Ví voucher của tôi')).toBeNull();
  });

  it('hides the voucher section when user has collected all available vouchers', () => {
    // User already collected all 4 vouchers
    mocks.myVouchers = sampleVouchers.map((p, i) => ({
      id: `v-${i}`,
      userId: 'user-1',
      promotionId: p.id,
      collectedAt: '2026-01-01T00:00:00Z',
      isUsed: false,
    }));

    const { container } = render(<HotVouchersSection />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Bạn đã thu thập toàn bộ voucher ưu đãi/i)).toBeNull();
  });

  it('moves a successfully collected voucher out of the discovery list', async () => {
    mocks.hotVouchers = [sampleVouchers[0]];
    render(<HotVouchersSection />);

    const saveButton = screen.getByRole('button', { name: 'Lưu mã' });
    fireEvent.click(saveButton);

    expect(mocks.collect).toHaveBeenCalledWith({ promotionId: 'promo-1' });

    await waitFor(() => expect(screen.queryByText('GIAM10')).toBeNull());
  });

  it('copies the complete actual code returned for the promotion', async () => {
    const code = 'ACTUAL-CREATED-VOUCHER-2026-LONG-CODE';
    mocks.hotVouchers = [{ ...sampleVouchers[0], code }];
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<HotVouchersSection />);
    expect(screen.getByText(code)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: `Sao chép mã ${code}` }));
    await waitFor(() => expect(screen.getByRole('button', { name: `Đã sao chép mã ${code}` })).toBeDefined());
    expect(writeText).toHaveBeenCalledWith(code);
  });

  it('does not invent a code or copy action for an automatic promotion', () => {
    mocks.hotVouchers = [{ ...sampleVouchers[0], code: undefined, applyType: 'AUTO_APPLY' }];
    render(<HotVouchersSection />);
    expect(screen.getByText('Tự động áp dụng')).toBeDefined();
    expect(screen.queryByText('TRIPRI')).toBeNull();
    expect(screen.queryByRole('button', { name: /Sao chép mã/ })).toBeNull();
  });

  it('keeps the voucher visible and reports a failed collection', async () => {
    mocks.hotVouchers = [sampleVouchers[0]];
    mocks.collect.mockReturnValue({ unwrap: () => Promise.reject(new Error('offline')) });
    render(<HotVouchersSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mã' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Không thể lưu voucher'));
    expect(screen.getByText('GIAM10')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Lưu mã' })).toHaveProperty('disabled', false);
  });

  it('does not report clipboard success when writing fails', async () => {
    mocks.hotVouchers = [sampleVouchers[0]];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<HotVouchersSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép mã GIAM10' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Không thể sao chép'));
    expect(screen.queryByRole('button', { name: /Đã sao chép/ })).toBeNull();
  });
});
