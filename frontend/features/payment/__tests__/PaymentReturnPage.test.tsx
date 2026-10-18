import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  meta,
  queryResult,
  subscription,
} from '@/features/guide/__tests__/finance.fixtures';

const mocks = vi.hoisted(() => ({
  payment: vi.fn(),
  history: vi.fn(),
  current: vi.fn(),
  checkout: vi.fn(),
  open: vi.fn(),
  paymentId: 'pay-1',
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams(mocks.paymentId ? { paymentId: mocks.paymentId } : {}),
}));
vi.mock('../api/paymentApi', () => ({
  useGetPaymentQuery: (...args: unknown[]) => mocks.payment(...args),
  useCheckoutBookingMutation: () => [mocks.checkout, { isLoading: false }],
}));
vi.mock('@/features/guide/api/subscriptionsApi', () => ({
  useGetMySubscriptionsQuery: (...args: unknown[]) => mocks.history(...args),
  useGetCurrentSubscriptionQuery: (...args: unknown[]) =>
    mocks.current(...args),
}));
vi.mock('../utils/checkout', () => ({ openCheckout: mocks.open }));
import { PaymentReturnContent } from '../components/PaymentReturnPage';

const payment = {
  id: 'pay-1',
  referenceId: 'sub-1',
  purpose: 'SUBSCRIPTION',
  amount: 199000,
  status: 'PENDING',
  expiresAt: '2026-10-01T00:30:00Z',
};
beforeEach(() => {
  mocks.paymentId = 'pay-1';
  mocks.payment.mockReturnValue(queryResult(payment));
  mocks.history.mockReturnValue(queryResult({ items: [subscription], meta }));
  mocks.current.mockReturnValue(
    queryResult({ active: false, subscription: null }),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('payment callbacks', () => {
  it('does not trust a cancel callback to declare cancellation, and never calls booking checkout for a subscription', () => {
    render(<PaymentReturnContent cancelled />);
    expect(
      screen.getByRole('heading', { name: 'Thanh toán chưa được xác nhận' }),
    ).toBeTruthy();
    expect(screen.queryByText('Giao dịch đã bị hủy')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thanh toán lại' })).toBeNull();
    expect(
      screen
        .getByRole('link', { name: /Quay lại gói dịch vụ/ })
        .getAttribute('href'),
    ).toBe('/guide/subscriptions');
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it('waits for subscription activation even after a PAID payment, then displays the matching backend period', () => {
    mocks.payment.mockReturnValue(queryResult({ ...payment, status: 'PAID' }));
    const view = render(<PaymentReturnContent />);
    expect(
      screen.getByText(/Chưa xác nhận được gói đã kích hoạt/),
    ).toBeTruthy();
    expect(screen.queryByText(/Guide Pro: Đã kích hoạt/)).toBeNull();
    mocks.history.mockReturnValue(
      queryResult({
        items: [
          {
            ...subscription,
            status: 'ACTIVE',
            startsAt: '2026-01-01T00:00:00Z',
            endsAt: '2026-01-31T00:00:00Z',
          },
        ],
        meta,
      }),
    );
    view.rerender(<PaymentReturnContent />);
    expect(screen.getByText(/Guide Pro: Đã kích hoạt/)).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Xem gói dịch vụ' })
        .getAttribute('href'),
    ).toBe('/guide/subscriptions');
    expect(screen.queryByText(/E-ticket/)).toBeNull();
  });
  it('honors PAID on the cancel route and handles FAILED separately from expiry', () => {
    mocks.payment.mockReturnValue(queryResult({ ...payment, status: 'PAID' }));
    const view = render(<PaymentReturnContent cancelled />);
    expect(
      screen.getByRole('heading', { name: 'Thanh toán thành công' }),
    ).toBeTruthy();
    mocks.payment.mockReturnValue(
      queryResult({ ...payment, status: 'FAILED' }),
    );
    view.rerender(<PaymentReturnContent />);
    expect(
      screen.getByRole('heading', { name: 'Thanh toán thất bại' }),
    ).toBeTruthy();
    expect(screen.queryByText('Phiên thanh toán đã hết hạn')).toBeNull();
  });
  it('hides stale private payment facts on API error and handles missing paymentId', () => {
    mocks.payment.mockReturnValue(queryResult(payment, { isError: true }));
    const view = render(<PaymentReturnContent />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('pay-1')).toBeNull();
    mocks.paymentId = '';
    view.rerender(<PaymentReturnContent />);
    expect(screen.getByText('Thiếu thông tin giao dịch')).toBeTruthy();
  });
  it('preserves booking checkout and ticket destinations, reporting retry errors', async () => {
    mocks.payment.mockReturnValue(
      queryResult({
        ...payment,
        purpose: 'BOOKING',
        referenceId: 'book-1',
        status: 'CANCELLED',
      }),
    );
    mocks.checkout.mockReturnValue({
      unwrap: async () => {
        throw { data: { error: { message: 'Booking expired' } } };
      },
    });
    const view = render(<PaymentReturnContent cancelled />);
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lại' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Booking expired',
    );
    expect(mocks.checkout).toHaveBeenCalledWith('book-1');
    expect(mocks.open).not.toHaveBeenCalled();
    mocks.payment.mockReturnValue(
      queryResult({
        ...payment,
        purpose: 'BOOKING',
        referenceId: 'book-1',
        status: 'PAID',
      }),
    );
    view.rerender(<PaymentReturnContent />);
    expect(
      screen
        .getByRole('link', { name: 'Xem vé điện tử (E-ticket)' })
        .getAttribute('href'),
    ).toBe('/settings/history/book-1/ticket');
  });
  it('bounds polling and stops on terminal status', async () => {
    vi.useFakeTimers();
    const view = render(<PaymentReturnContent />);
    expect(mocks.payment.mock.calls.at(-1)![1].pollingInterval).toBe(2500);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21000);
    });
    expect(mocks.payment.mock.calls.at(-1)![1].pollingInterval).toBe(0);
    mocks.payment.mockReturnValue(
      queryResult({ ...payment, status: 'CANCELLED' }),
    );
    view.rerender(<PaymentReturnContent />);
    expect(mocks.payment.mock.calls.at(-1)![1].pollingInterval).toBe(0);
  });
});
