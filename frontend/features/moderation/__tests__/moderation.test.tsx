import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationAgency, ModerationTour } from '../types';

const mockTours = vi.fn();
const mockAgencies = vi.fn();
const mockDashboard = vi.fn();
const mockValidate = vi.fn();
const mockSuspend = vi.fn();
const mockVerify = vi.fn();
let permissions: string[] = [];

vi.mock('../api/moderationApi', () => ({
  useGetModerationToursQuery: (...a: unknown[]) => mockTours(...a),
  useGetModerationAgenciesQuery: (...a: unknown[]) => mockAgencies(...a),
  useGetModerationDashboardQuery: (...a: unknown[]) => mockDashboard(...a),
  useValidateTourMutation: () => [mockValidate, { isLoading: false }],
  useSuspendTourMutation: () => [mockSuspend, { isLoading: false }],
  useVerifyAgencyMutation: () => [mockVerify, { isLoading: false }],
}));
vi.mock('../components/ModerationUi', async (orig) => ({
  ...(await orig<typeof import('../components/ModerationUi')>()),
  useModerationPermission: (p: string) => permissions.includes(p),
}));

import { ModerationAgencyListPage } from '../components/ModerationAgencyListPage';
import { ModerationDashboardPage } from '../components/ModerationDashboardPage';
import { ModerationTourListPage } from '../components/ModerationTourListPage';
import { validateReason } from '../labels';

vi.mock('@/store/hooks', () => ({ useAppSelector: () => ({ fullName: 'Mod A', permissions: [] }) }));
vi.mock('@/features/auth', () => ({ selectUser: () => null }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };
const tour = (over: Partial<ModerationTour> = {}): ModerationTour => ({
  id: 't1',
  title: 'Đà Nẵng 3N2Đ',
  destination: 'Đà Nẵng',
  durationDays: 3,
  basePrice: 1000000,
  status: 'PENDING_REVIEW',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
  agency: { id: 'a1', name: 'Agency X' },
  ...over,
});
const agency = (status: 'PENDING' | 'VERIFIED' = 'PENDING'): ModerationAgency => ({
  id: 'u1',
  email: 'a@x.vn',
  fullName: 'Nguyen A',
  status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00.000Z',
  agencyProfile: { companyName: 'Cong ty X', verificationStatus: status },
});
const q = (over: Record<string, unknown>) => ({ data: undefined, isLoading: false, isFetching: false, isError: false, refetch: vi.fn(), ...over });
const unwrapOk = () => ({ unwrap: () => Promise.resolve({}) });
const unwrapFail = (code: string, message: string) => ({ unwrap: () => Promise.reject({ data: { error: { code, message } } }) });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  permissions = [];
});

describe('validateReason', () => {
  it('mirrors the backend 3..1000 rule', () => {
    expect(validateReason(' ab ')).toBeTruthy();
    expect(validateReason('abc')).toBeNull();
    expect(validateReason('x'.repeat(1001))).toBeTruthy();
  });
});

describe('permissions', () => {
  it('denies tour list, agency list and dashboard without the permission', () => {
    mockTours.mockReturnValue(q({}));
    mockAgencies.mockReturnValue(q({}));
    mockDashboard.mockReturnValue(q({}));
    for (const el of [<ModerationTourListPage key="t" />, <ModerationAgencyListPage key="a" />, <ModerationDashboardPage key="d" />]) {
      const { unmount } = render(el);
      expect(screen.getByRole('alert').textContent).toContain('không có quyền');
      unmount();
    }
    // The queries are skipped so no request is sent.
    expect(mockTours.mock.calls[0][1]).toEqual({ skip: true });
  });
});

describe('ModerationTourListPage', () => {
  const allowAll = () => (permissions = ['tour:list-all', 'tour:validate', 'tour:suspend']);

  it('renders loading, error and empty states', () => {
    allowAll();
    mockTours.mockReturnValue(q({ isLoading: true }));
    const { rerender } = render(<ModerationTourListPage />);
    expect(screen.getByRole('status')).toBeTruthy();
    mockTours.mockReturnValue(q({ isError: true }));
    rerender(<ModerationTourListPage />);
    expect(screen.getByRole('alert').textContent).toContain('Không thể tải');
    mockTours.mockReturnValue(q({ data: { items: [], meta: { ...META, total: 0 } } }));
    rerender(<ModerationTourListPage />);
    expect(screen.getByText('Không có tour nào')).toBeTruthy();
  });

  it('approves a pending tour and shows success only after the backend confirms', async () => {
    allowAll();
    mockTours.mockReturnValue(q({ data: { items: [tour()], meta: META } }));
    mockValidate.mockReturnValue(unwrapOk());
    render(<ModerationTourListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.click(screen.getByText('Duyệt tour'));
    await waitFor(() => expect(mockValidate).toHaveBeenCalledWith({ id: 't1', approve: true }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã duyệt tour'));
  });

  it('requires a reason to reject and does not call the backend without one', () => {
    allowAll();
    mockTours.mockReturnValue(q({ data: { items: [tour()], meta: META } }));
    render(<ModerationTourListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.click(screen.getByText('Từ chối'));
    expect(screen.getByText(/ít nhất 3 ký tự/)).toBeTruthy();
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('keeps the dialog open, shows no success and refetches when the backend refuses', async () => {
    allowAll();
    const refetch = vi.fn();
    mockTours.mockReturnValue(q({ data: { items: [tour({ status: 'APPROVED' })], meta: META }, refetch }));
    mockSuspend.mockReturnValue(unwrapFail('INVALID_STATE_TRANSITION', 'nope'));
    render(<ModerationTourListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.change(screen.getByLabelText(/Lý do tạm ngưng/), { target: { value: 'Sai thông tin' } });
    fireEvent.click(screen.getByText('Tạm ngưng tour'));
    await waitFor(() => expect(mockSuspend).toHaveBeenCalledWith({ id: 't1', reason: 'Sai thông tin' }));
    await waitFor(() => expect(screen.getAllByRole('alert')[0].textContent).toContain('Trạng thái hiện tại không cho phép'));
    expect(screen.queryByText(/Đã tạm ngưng tour/)).toBeNull();
    expect(refetch).toHaveBeenCalled();
  });

  it('hides decision actions without validate/suspend permission', () => {
    permissions = ['tour:list-all'];
    mockTours.mockReturnValue(q({ data: { items: [tour()], meta: META } }));
    render(<ModerationTourListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    expect(screen.queryByText('Duyệt tour')).toBeNull();
    expect(screen.queryByText('Từ chối')).toBeNull();
  });

  it('offers no action for tours that cannot be decided', () => {
    allowAll();
    mockTours.mockReturnValue(q({ data: { items: [tour({ status: 'SUSPENDED' })], meta: META } }));
    render(<ModerationTourListPage />);
    fireEvent.click(screen.getByText('Xem chi tiết'));
    expect(screen.queryByText('Tạm ngưng tour')).toBeNull();
    expect(screen.queryByText('Duyệt tour')).toBeNull();
  });
});

describe('ModerationAgencyListPage', () => {
  it('verifies a pending agency', async () => {
    permissions = ['agency:verify'];
    mockAgencies.mockReturnValue(q({ data: { items: [agency()], meta: META } }));
    mockVerify.mockReturnValue(unwrapOk());
    render(<ModerationAgencyListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.click(screen.getByText('Xác minh'));
    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith({ id: 'u1', approve: true }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã xác minh agency'));
  });

  it('requires a note to reject', () => {
    permissions = ['agency:verify'];
    mockAgencies.mockReturnValue(q({ data: { items: [agency()], meta: META } }));
    render(<ModerationAgencyListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.click(screen.getByText('Từ chối'));
    expect(screen.getByText(/ít nhất 3 ký tự/)).toBeTruthy();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('shows the backend error on failure and no success message', async () => {
    permissions = ['agency:verify'];
    mockAgencies.mockReturnValue(q({ data: { items: [agency()], meta: META } }));
    mockVerify.mockReturnValue(unwrapFail('FORBIDDEN', 'x'));
    render(<ModerationAgencyListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.click(screen.getByText('Xác minh'));
    await waitFor(() => expect(screen.getAllByRole('alert')[0].textContent).toContain('không có quyền'));
    expect(screen.queryByText(/Đã xác minh agency/)).toBeNull();
  });

  it('has no actions for an already verified agency', () => {
    permissions = ['agency:verify'];
    mockAgencies.mockReturnValue(q({ data: { items: [agency('VERIFIED')], meta: META } }));
    render(<ModerationAgencyListPage />);
    fireEvent.click(screen.getByText('Xem chi tiết'));
    expect(screen.queryByText('Từ chối')).toBeNull();
  });
});

describe('ModerationDashboardPage', () => {
  it('shows backend queue counts', () => {
    permissions = ['moderation:dashboard', 'tour:list-all', 'agency:verify'];
    mockDashboard.mockReturnValue(
      q({
        data: {
          generatedAt: '2026-10-16T00:00:00.000Z',
          queues: { toursPendingReview: 7, agenciesPendingVerification: 3, reportsOpen: 1, reportsAwaitingDecision: 2, supportTicketsOpen: 4, supportTicketsInProgress: 1 },
          tours: { APPROVED: 5 },
          reviews: { visible: 0, hidden: 0 },
        },
      }),
    );
    render(<ModerationDashboardPage />);
    expect(screen.getByTestId('tile-Tour chờ duyệt').textContent).toBe('7');
    expect(screen.getByTestId('tile-Agency chờ xác minh').textContent).toBe('3');
    expect(screen.getByTestId('tile-Báo cáo đang mở').textContent).toBe('3');
  });
});
