import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PremiumWalletSection } from '../PremiumWalletSection';

const { state } = vi.hoisted(() => ({
  state: {
    user: { id: 'traveler-1', role: 'TRAVELER' },
    query: { currentData: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() },
  },
}));
vi.mock('@/features/auth', () => ({ selectUser: vi.fn() }));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => state.user }));
vi.mock('../api', () => ({ usePremiumVouchersQuery: () => state.query }));

afterEach(() => {
  cleanup();
  state.query.currentData = [];
  state.query.isLoading = false;
  state.query.isError = false;
  vi.clearAllMocks();
});

describe('PremiumWalletSection', () => {
  it('renders nothing when no Premium vouchers have been issued', () => {
    const { container } = render(<PremiumWalletSection />);
    expect(container.innerHTML).toBe('');
  });

  it('renders ticket cards without a separate heading or divider', () => {
    state.query.currentData = [{
      id: 'premium-1',
      terms: { title: 'Ưu đãi hội viên', agencyId: 'agency-1', tourIds: ['tour-1'], discountType: 'PERCENT', discountValue: 10, minOrderAmount: 0 },
      startsAt: new Date(Date.now() - 86400000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      heldAt: null,
      bookingId: null,
    }];
    const { container } = render(<PremiumWalletSection />);
    expect(screen.getByRole('heading', { name: 'Ưu đãi hội viên' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Voucher Premium' })).toBeNull();
    expect(container.firstElementChild?.className).toBe('space-y-4');
    expect(screen.queryByText('Dùng ngay')).toBeNull();
  });

  it('keeps a retry action when voucher loading fails', () => {
    state.query.isError = true;
    render(<PremiumWalletSection />);
    expect(screen.getByRole('button', { name: /Thử lại/ })).toBeDefined();
  });
});
