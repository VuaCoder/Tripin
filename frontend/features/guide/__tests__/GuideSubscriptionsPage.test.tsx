import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta, plan, subscription, queryResult } from './finance.fixtures';

const mocks = vi.hoisted(() => ({
  plans: vi.fn(),
  current: vi.fn(),
  history: vi.fn(),
  subscribe: vi.fn(),
  open: vi.fn(),
}));
vi.mock('../api/subscriptionsApi', () => ({
  useGetSubscriptionPlansQuery: (...args: unknown[]) => mocks.plans(...args),
  useGetCurrentSubscriptionQuery: (...args: unknown[]) =>
    mocks.current(...args),
  useGetMySubscriptionsQuery: (...args: unknown[]) => mocks.history(...args),
  useSubscribeToPlanMutation: () => [mocks.subscribe, { isLoading: false }],
}));
vi.mock('@/features/payment/utils/checkout', () => ({
  openCheckout: mocks.open,
}));
import { SubscriptionsContent } from '../components/GuideSubscriptionsPage';

beforeEach(() => {
  mocks.plans.mockReturnValue(queryResult([plan]));
  mocks.current.mockReturnValue(
    queryResult({ active: false, subscription: null }),
  );
  mocks.history.mockReturnValue(queryResult({ items: [], meta }));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Subscribe to Plan', () => {
  it('shows empty and independently failed current without claiming there is no active plan', () => {
    mocks.current.mockReturnValue(queryResult(undefined, { isError: true }));
    render(<SubscriptionsContent />);
    expect(screen.getByText('Không thể tải gói hiện tại')).toBeTruthy();
    expect(screen.queryByText('Bạn chưa có gói đang có hiệu lực')).toBeNull();
    expect(screen.getByText('Chưa có lịch sử đăng ký')).toBeTruthy();
    expect(screen.getByRole('heading', { name: plan.name })).toBeTruthy();
  });
  it('confirms the selected plan then opens only the returned checkout without announcing activation', async () => {
    mocks.subscribe.mockReturnValue({
      unwrap: async () => ({
        subscription,
        checkout: { checkoutUrl: 'https://pay.payos.vn/test' },
      }),
    });
    render(<SubscriptionsContent />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Đăng ký gói Guide Pro' }),
    );
    expect(mocks.subscribe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục đến PayOS' }));
    await waitFor(() =>
      expect(mocks.open).toHaveBeenCalledWith('https://pay.payos.vn/test'),
    );
    expect(mocks.subscribe).toHaveBeenCalledWith(plan.id);
    expect(screen.queryByText('Đã kích hoạt')).toBeNull();
  });
  it('displays the backend error and refreshes pending history without success or redirect', async () => {
    const refetch = vi.fn();
    mocks.history.mockReturnValue(
      queryResult({ items: [], meta }, { refetch }),
    );
    mocks.subscribe.mockReturnValue({
      unwrap: async () => {
        throw { data: { error: { message: 'Payment provider unavailable' } } };
      },
    });
    render(<SubscriptionsContent />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Đăng ký gói Guide Pro' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục đến PayOS' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Payment provider unavailable',
    );
    expect(mocks.open).not.toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
  });
  it('continues a pending subscription using planId and shows a future paid period accurately', async () => {
    mocks.history.mockReturnValue(
      queryResult({
        items: [
          subscription,
          {
            ...subscription,
            id: 'future',
            status: 'ACTIVE',
            startsAt: '2099-01-01T00:00:00Z',
          },
        ],
        meta,
      }),
    );
    mocks.subscribe.mockReturnValue({
      unwrap: async () => ({
        subscription,
        checkout: { checkoutUrl: 'https://pay.payos.vn/test' },
      }),
    });
    render(<SubscriptionsContent />);
    expect(screen.getByText('Đã thanh toán · Chờ hiệu lực')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Tiếp tục thanh toán Guide Pro' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục đến PayOS' }));
    await waitFor(() => expect(mocks.subscribe).toHaveBeenCalledWith(plan.id));
  });
});
