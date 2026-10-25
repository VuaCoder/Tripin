import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PremiumAvatar,
  PremiumStatusText,
  OwnPremiumIdentity,
  useOwnPremium,
} from '../PremiumIdentity';
const membership = vi.hoisted(() => ({ endsAt: '2026-11-25T10:00:00Z' }));
vi.mock('@/store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { user: { id: 'a', role: 'TRAVELER' } } }),
}));
vi.mock('../api', () => ({
  useMyPremiumQuery: () => ({
    currentData: { active: true, endsAt: membership.endsAt, expired: false },
  }),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function ManagedStatus() {
  const query = useOwnPremium('a');
  return <PremiumStatusText status={query.premium} showInactive />;
}
describe('Premium identity', () => {
  it('removes the frame at the actual expiry without waiting for the next API poll', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T00:00:00Z'));
    membership.endsAt = '2026-10-25T00:00:01Z';
    render(
      <>
        <OwnPremiumIdentity userId="a" name="An" />
        <ManagedStatus />
      </>,
    );
    expect(
      screen.getByRole('img', { name: 'Thành viên Premium' }),
    ).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1002);
    });
    expect(
      screen.queryByRole('img', { name: 'Thành viên Premium' }),
    ).toBeNull();
    expect(screen.getByText('Premium đã hết hạn')).toBeTruthy();
  });
  it('never applies the signed-in membership to a different account avatar', () => {
    membership.endsAt = new Date(Date.now() + 86400000).toISOString();
    render(<OwnPremiumIdentity userId="other" name="Other" />);
    expect(
      screen.queryByRole('img', { name: 'Thành viên Premium' }),
    ).toBeNull();
  });
  it('shows a gold membership badge on the fallback avatar and keeps it after an image fails', () => {
    render(
      <PremiumAvatar
        active
        url="https://example.com/avatar.png"
        name="Nguyen An"
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Thành viên Premium' }),
    ).toBeTruthy();
    fireEvent.error(
      screen.getByRole('img', { name: 'Ảnh đại diện của Nguyen An' }),
    );
    expect(
      screen.getByLabelText('Ảnh đại diện mặc định của Nguyen An'),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Thành viên Premium' }),
    ).toBeTruthy();
  });
  it('omits the badge for inactive users', () => {
    render(<PremiumAvatar name="An" active={false} />);
    expect(
      screen.queryByRole('img', { name: 'Thành viên Premium' }),
    ).toBeNull();
  });
  it('uses the required label and Vietnam date even across the UTC date boundary', () => {
    render(
      <PremiumStatusText
        status={{
          active: true,
          endsAt: '2026-11-24T18:00:00Z',
          expired: false,
        }}
      />,
    );
    expect(screen.getByText('Premium')).toBeTruthy();
    expect(screen.getByText('Hoạt động đến 25/11/2026')).toBeTruthy();
    expect(screen.queryByText('Gói Premium')).toBeNull();
  });
  it('distinguishes fetch errors from expiration and supports retry', () => {
    const retry = vi.fn();
    render(<PremiumStatusText error onRetry={retry} showInactive />);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText('Premium đã hết hạn')).toBeNull();
  });
  it('reports expiration in the management status', () => {
    render(
      <PremiumStatusText
        showInactive
        status={{ active: false, endsAt: null, expired: true }}
      />,
    );
    expect(screen.getByText('Premium đã hết hạn')).toBeTruthy();
  });
});
