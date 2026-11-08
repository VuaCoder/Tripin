import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: { id: 'u1', role: 'TRAVELER' }, query: vi.fn() }));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => mocks.user }));
vi.mock('@/features/auth', () => ({ selectUser: vi.fn() }));
vi.mock('../api/eTicketApi', () => ({ useGetMyETicketsQuery: (...args: unknown[]) => mocks.query(...args) }));
vi.mock('../components/QRCodeDisplay', () => ({ QRCodeDisplay: ({ value }: { value: string }) => <div data-testid="ticket-qr">{value}</div> }));
import { ETicketList } from '../components/ETicketList';
const data = { items: [{ id: 'e1', code: 'QR-CODE-1', status: 'VALID', tour: { id: 't1', title: 'My ticketed tour', meetingPoint: 'Meeting point' }, departureDate: '2030-01-01', participants: 2 }], meta: { page: 1, totalPages: 1 } };
beforeEach(() => { localStorage.clear(); mocks.user = { id: 'u1', role: 'TRAVELER' }; mocks.query.mockReturnValue({ currentData: data }); });
afterEach(cleanup);
describe('traveler ticket list', () => {
  it('shows the departure, meeting point and QR and can reopen cached tickets offline', async () => {
    const view = render(<ETicketList />);
    expect(screen.getByText('Meeting point', { exact: false })).toBeTruthy();
    expect(screen.getByTestId('ticket-qr').textContent).toBe('QR-CODE-1');
    view.unmount();
    mocks.query.mockReturnValue({ isError: true, error: { status: 'FETCH_ERROR' } });
    render(<ETicketList />);
    await waitFor(() => expect(screen.getByText('My ticketed tour')).toBeTruthy());
  });
  it('does not use cached tickets after an authorization error or for another account', async () => {
    const view = render(<ETicketList />); view.unmount();
    mocks.query.mockReturnValue({ isError: true, error: { status: 403 } });
    const denied = render(<ETicketList />);
    await waitFor(() => expect(screen.queryByTestId('ticket-qr')).toBeNull());
    denied.unmount(); mocks.user = { id: 'u2', role: 'TRAVELER' };
    mocks.query.mockReturnValue({ isError: true, error: { status: 'FETCH_ERROR' } });
    render(<ETicketList />);
    await waitFor(() => expect(screen.queryByTestId('ticket-qr')).toBeNull());
  });
});
