import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  plans: [
    {
      id: 'plan-a',
      name: 'Premium 30 ngày',
      price: 99000,
      durationDays: 30,
      benefits: ['Voucher theo kỳ'],
      audience: 'TRAVELER',
      version: 1,
    },
  ],
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
    refetch: mocks.retry,
  }),
  usePremiumVouchersQuery: () => ({ currentData: [], refetch: mocks.retry }),
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
  it('shows active membership, avatar badge and manual renewal', () => {
    render(<PremiumPage />);
    expect(
      screen.getByRole('img', { name: 'Thành viên Premium' }),
    ).toBeTruthy();
    expect(screen.getByText(/Hoạt động đến/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Gia hạn Premium' }),
    ).toBeTruthy();
  });
  it('does not show the gold badge for a future-only period', () => {
    mocks.status = { active: false, endsAt: null, expired: false };
    mocks.history = [
      {
        id: 'future',
        planName: 'Premium 30 ngày',
        price: 99000,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 31 * 86400000).toISOString(),
        revokedAt: null,
      },
    ];
    render(<PremiumPage />);
    expect(
      screen.queryByRole('img', { name: 'Thành viên Premium' }),
    ).toBeNull();
    expect(screen.getByText(/Chờ kỳ bắt đầu/)).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Gia hạn Premium' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Gia hạn Premium' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it('submits a refund request for the chosen future period', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu hoàn tiền' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Lý do hoàn tiền' }), {
      target: { value: 'Không sử dụng kỳ gia hạn' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith({
        url: '/premium/subscriptions/future/refunds',
        body: { reason: 'Không sử dụng kỳ gia hạn' },
      }),
    );
  });
  it('clears local refund editing state when the signed-in identity changes', () => {
    mocks.history = [
      {
        id: 'future',
        planName: 'Kỳ tiếp theo',
        price: 99000,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 31 * 86400000).toISOString(),
        revokedAt: null,
      },
    ];
    const view = render(<PremiumPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu hoàn tiền' }));
    expect(
      screen.getByRole('textbox', { name: 'Lý do hoàn tiền' }),
    ).toBeTruthy();
    mocks.user = { id: 'traveler-b', role: 'TRAVELER', fullName: 'Trần Bình' };
    mocks.history = [];
    mocks.status = { active: false, endsAt: null, expired: false };
    view.rerender(<PremiumPage />);
    expect(
      screen.queryByRole('textbox', { name: 'Lý do hoàn tiền' }),
    ).toBeNull();
    expect(
      screen.queryByRole('img', { name: 'Thành viên Premium' }),
    ).toBeNull();
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
});
