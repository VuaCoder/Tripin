import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PremiumPlan, PremiumVoucher } from '../api';
const mocks = vi.hoisted(() => ({
  user: { id: 'traveler-a', role: 'TRAVELER', fullName: 'Nguyễn An' } as {
    id: string;
    role: string;
    fullName: string;
  } | null,
  status: { active: true, endsAt: '2026-11-25T10:00:00Z', expired: false } as {
    active: boolean;
    endsAt: string | null;
    expired: boolean;
  },
  statusError: false,
  plans: [] as PremiumPlan[],
  vouchers: [] as PremiumVoucher[],
  historyError: false,
  vouchersError: false,
  history: [] as {
    id: string;
    planName: string;
    price: number;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
    revokedAt: string | null;
  }[],
  buy: vi.fn(),
  mutate: vi.fn(),
  open: vi.fn(),
  retry: vi.fn(),
}));
vi.mock('@/store/hooks', () => ({
  useAppSelector: (select: (state: unknown) => unknown) =>
    select({ auth: { user: mocks.user } }),
}));
vi.mock('@/features/auth', () => ({
  selectUser: (state: { auth: { user: unknown } }) => state.auth.user,
}));
vi.mock('../GuidePremiumEditor', () => ({
  GuidePremiumEditor: () => <div>Hồ sơ Guide Premium</div>,
}));
vi.mock('@/features/payment/utils/checkout', () => ({
  openCheckout: mocks.open,
}));
vi.mock('../api', () => ({
  useMyPremiumQuery: () => ({
    currentData: mocks.status,
    isError: mocks.statusError,
    refetch: mocks.retry,
  }),
  usePremiumPlansQuery: () => ({
    currentData: mocks.plans,
    refetch: mocks.retry,
  }),
  usePremiumHistoryQuery: () => ({
    currentData: { items: mocks.history, meta: { page: 1, totalPages: 1 } },
    isError: mocks.historyError,
    refetch: mocks.retry,
  }),
  usePremiumVouchersQuery: () => ({
    currentData: mocks.vouchers,
    isError: mocks.vouchersError,
    refetch: mocks.retry,
  }),
  usePremiumSubscribeMutation: () => [mocks.buy, { isLoading: false }],
  usePremiumMutationMutation: () => [mocks.mutate, { isLoading: false }],
}));
import { PremiumPage } from '../PremiumPage';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'traveler-a', role: 'TRAVELER', fullName: 'Nguyễn An' };
  mocks.status = {
    active: true,
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    expired: false,
  };
  mocks.statusError = false;
  mocks.history = [];
  mocks.historyError = false;
  mocks.vouchersError = false;
  mocks.vouchers = [];
  mocks.plans = [
    {
      id: 'plan-a',
      code: 'PREMIUM_30',
      name: 'Premium 30 ngày',
      price: 99000,
      durationDays: 30,
      benefits: ['Voucher theo kỳ'],
      audience: 'TRAVELER',
      version: 1,
    },
  ];
  mocks.buy.mockReturnValue({
    unwrap: () =>
      Promise.resolve({
        checkout: { checkoutUrl: 'https://pay.payos.vn/test' },
      }),
  });
  mocks.mutate.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});
afterEach(cleanup);
describe('Premium customer experience', () => {
  it('shows active membership, avatar badge and the simplified registration button', () => {
    render(<PremiumPage />);
    expect(
      screen.getByRole('img', { name: 'Thành viên Premium' }),
    ).toBeTruthy();
    expect(screen.getByText(/Hoạt động đến/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Đăng ký gói' }),
    ).toBeTruthy();
  });
  it('does not show the gold badge for inactive membership', () => {
    mocks.status = { active: false, endsAt: null, expired: false };
    render(<PremiumPage />);
    expect(
      screen.queryByRole('img', { name: 'Thành viên Premium' }),
    ).toBeNull();
  });
  it('treats a status failure as retryable instead of claiming membership has expired', () => {
    mocks.statusError = true;
    render(<PremiumPage />);
    expect(
      screen.queryByRole('img', { name: 'Thành viên Premium' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(mocks.retry).toHaveBeenCalled();
    expect(screen.queryByText('Premium đã hết hạn')).toBeNull();
  });
  it('buys with only the server plan ID and navigates after checkout succeeds', async () => {
    render(<PremiumPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký gói' }));
    await waitFor(() =>
      expect(mocks.open).toHaveBeenCalledWith('https://pay.payos.vn/test'),
    );
    expect(mocks.buy).toHaveBeenCalledWith('plan-a');
  });
  it('preserves the page and reports failed checkout', async () => {
    mocks.buy.mockReturnValue({
      unwrap: () => Promise.reject(new Error('offline')),
    });
    render(<PremiumPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký gói' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it('does not display redundant history cards or confusing terms', () => {
    mocks.history = [
      {
        id: 'future',
        planName: 'Premium kỳ sau',
        price: 99000,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 31 * 86400000).toISOString(),
        revokedAt: null,
      },
    ];
    render(<PremiumPage />);
    expect(screen.queryByText('Các kỳ Premium của bạn')).toBeNull();
    expect(screen.queryByText('Điều kiện sử dụng')).toBeNull();
  });
  it('lets guests inspect plans and directs them to sign in', () => {
    mocks.user = null;
    render(<PremiumPage />);
    expect(
      screen
        .getByRole('link', { name: 'Đăng nhập để đăng ký' })
        .getAttribute('href'),
    ).toBe('/login?next=/premium');
  });
  it('removes repetitive copy and empty sections', () => {
    mocks.status = { active: false, endsAt: null, expired: false };
    mocks.plans[0].description = 'Mô tả quảng bá dài không cần thiết';
    mocks.plans[0].benefits = ['2 voucher theo kỳ', '2 voucher theo kỳ'];
    mocks.plans[0].vouchers = [
      {
        quantity: 2,
        title: '[DEV Premium] Giảm 10% tour trải nghiệm',
        tourIds: ['tour-a'],
        discountType: 'PERCENT',
        discountValue: 10,
        maxDiscountAmount: 100000,
        minOrderAmount: 500000,
      },
    ];
    const { container } = render(<PremiumPage />);
    expect(screen.getAllByText('2 voucher theo kỳ')).toHaveLength(1);
    expect(screen.queryByText(/\[DEV Premium\]/)).toBeNull();
    expect(screen.queryByText(mocks.plans[0].description)).toBeNull();
    expect(screen.queryByText(/Chưa có Premium đang hiệu lực/)).toBeNull();
    expect(screen.queryByText('Các kỳ Premium của bạn')).toBeNull();
    expect(screen.queryByText('Ví voucher Premium')).toBeNull();
    expect(screen.queryByText('Điều kiện sử dụng')).toBeNull();
    expect(screen.queryByText(/Hiển thị tối đa 500/)).toBeNull();
    expect(container.textContent).not.toMatch(
      /Privilege Club|Hội Viên Đặc Quyền|Nhấp để chọn|đang được chọn/,
    );
  });
  it('keeps voucher quantities and conditions when no benefit summary is configured', () => {
    mocks.plans[0].benefits = [];
    mocks.plans[0].vouchers = [
      {
        quantity: 2,
        title: '[DEV Premium] Voucher',
        tourIds: ['tour-a'],
        discountType: 'PERCENT',
        discountValue: 10,
        minOrderAmount: 500000,
      },
    ];
    render(<PremiumPage />);
    expect(screen.getByText(/2 voucher · Giảm 10% · Đơn từ/)).toBeTruthy();
    expect(screen.queryByText(/tối đa/)).toBeNull();
    expect(screen.queryByText(/\[DEV Premium\]/)).toBeNull();
  });
  it('does not hide voucher load failures as empty sections', () => {
    mocks.vouchersError = true;
    render(<PremiumPage />);
    expect(screen.getByText('Ví voucher Premium')).toBeTruthy();
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    fireEvent.click(retryBtn);
    expect(mocks.retry).toHaveBeenCalled();
  });
  it('shows issued vouchers without the technical display-limit note', () => {
    mocks.vouchers = [
      {
        id: 'voucher-a',
        terms: {
          title: 'Ưu đãi hội viên',
          agencyId: 'agency-a',
          tourIds: ['tour-a'],
          discountType: 'PERCENT',
          discountValue: 10,
          minOrderAmount: 500000,
        },
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        heldAt: null,
        bookingId: null,
      },
    ];
    render(<PremiumPage />);
    expect(screen.getByText('Ví voucher Premium')).toBeTruthy();
    expect(screen.getByText('Ưu đãi hội viên')).toBeTruthy();
    expect(screen.queryByText(/Hiển thị tối đa 500/)).toBeNull();
  });
  it('allows selecting a plan card and registers the selected plan ID via the shared action button', async () => {
    mocks.plans.push({
      ...mocks.plans[0],
      id: 'plan-b',
      code: 'PREMIUM_90',
      name: 'Premium 90 ngày',
      durationDays: 90,
      price: 129000,
    });
    render(<PremiumPage />);
    const submitBtn = screen.getByRole('button', { name: 'Đăng ký gói' });

    // By default first plan 'plan-a' is selected
    fireEvent.click(submitBtn);
    await waitFor(() => expect(mocks.buy).toHaveBeenCalledWith('plan-a'));

    // Click plan-b card to select it
    fireEvent.click(screen.getByText('Premium 90 ngày'));
    fireEvent.click(submitBtn);
    await waitFor(() => expect(mocks.buy).toHaveBeenCalledWith('plan-b'));
    expect(mocks.buy).toHaveBeenCalledTimes(2);
  });
});
