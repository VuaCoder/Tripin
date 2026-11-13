import { configureStore } from '@reduxjs/toolkit';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authReducer, { restoreCredentials, setCredentials } from '@/features/auth/store/authSlice';
import { membershipFixture } from '@/test/agencySession';
import AgencyLayout from '@/app/agency/layout';

const mocks = vi.hoisted(() => ({ pathname: '/agency/tours', replace: vi.fn(), error: false, retry: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('../agencyContext', () => ({ useAgencyMembershipsQuery: () => ({ isError: mocks.error, refetch: mocks.retry }) }));
vi.mock('../components/AgencyNav', () => ({ AgencyNav: () => <nav>Agency navigation</nav> }));
vi.mock('@ant-design/nextjs-registry', () => ({ AntdRegistry: ({ children }: any) => <>{children}</> }));
const user = { id: 'actor', role: 'TRAVELER', permissions: ['tour:update-own'] } as any;
const owner = membershipFixture({ permissions: ['tour:update-own','agency:dashboard'] });
const accountant = membershipFixture({ agencyId: '22222222-2222-4222-8222-222222222222', memberId: 'accountant', memberRole: 'ACCOUNTANT', permissions: ['agency:finance-view','agency:bookings-view'] });
function mount(agencies = [owner], restore = false) {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch((restore ? restoreCredentials : setCredentials)({ user, accessToken: 'token', agencies }));
  render(<Provider store={store}><AgencyLayout><div>Protected business screen</div></AgencyLayout></Provider>);
  return store;
}
beforeEach(() => { mocks.pathname = '/agency/tours'; mocks.error = false; vi.clearAllMocks(); });
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });
describe('Agency membership layout gates', () => {
  it('allows a Traveler with an active OWNER membership into the agency shell', () => {
    mount(); expect(screen.getByText('Protected business screen')).toBeDefined();
  });
  it('requires explicit agency selection before mounting business screens', () => {
    mount([owner,accountant]); expect(screen.queryByText('Protected business screen')).toBeNull();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: owner.agencyId } });
    expect(screen.getByText('Protected business screen')).toBeDefined();
  });
  it('does not trust cached permissions before server synchronization', () => {
    mount([owner], true); expect(screen.getByRole('status').textContent).toContain('Đang xác minh');
    expect(screen.queryByText('Protected business screen')).toBeNull();
  });
  it('offers retry when membership synchronization fails', () => {
    mocks.error = true; mount([owner], true);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); expect(mocks.retry).toHaveBeenCalledOnce();
    expect(screen.queryByText('Protected business screen')).toBeNull();
  });
  it('preserves personal access navigation when no membership remains', () => {
    mount([]); expect(screen.getByRole('link', { name: 'Về trang cá nhân' })).toBeDefined();
    expect(screen.queryByText('Protected business screen')).toBeNull(); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('blocks Accountant tour management even if the personal user permissions contain it', () => {
    mount([accountant]); expect(screen.getByRole('alert').textContent).toContain('không có quyền');
    expect(screen.queryByText('Protected business screen')).toBeNull();
  });
  it('allows Accountant booking views using membership permissions', () => {
    mocks.pathname = '/agency/bookings'; mount([accountant]); expect(screen.getByText('Protected business screen')).toBeDefined();
  });
  it('blocks Staff finance access by direct URL', () => {
    mocks.pathname = '/agency/finance'; mount([membershipFixture({ memberRole: 'STAFF', permissions: ['tour:update-own'] })]);
    expect(screen.queryByText('Protected business screen')).toBeNull(); expect(screen.getByRole('alert')).toBeDefined();
  });
  it('uses selected-company verification, not the personal profile', () => {
    mount([membershipFixture({ verificationStatus: 'PENDING' })]);
    expect(screen.getByText('Doanh nghiệp chưa được xác minh')).toBeDefined(); expect(screen.queryByText('Protected business screen')).toBeNull();
  });
});
