import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), complaints: vi.fn(), mainRetry: vi.fn(), complaintRetry: vi.fn(), permissions: [] as string[] }));
vi.mock('../api/moderationApi', () => ({ useGetModerationDashboardQuery: (...args: unknown[]) => mocks.dashboard(...args) }));
vi.mock('@/features/complaints/api/complaintsApi', () => ({ useGetModeratorComplaintsQuery: (...args: unknown[]) => mocks.complaints(...args) }));
vi.mock('../components/SlaTrends', () => ({ SlaTrends: () => null }));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => ({ fullName: 'Moderator', permissions: mocks.permissions }) }));
vi.mock('@/features/auth', () => ({ selectUser: () => null }));
vi.mock('../components/ModerationUi', async (original) => ({ ...await original<object>(), useModerationPermission: (p: string) => mocks.permissions.includes(p) }));
import { ModerationDashboardPage } from '../components/ModerationDashboardPage';
beforeEach(() => {
  vi.clearAllMocks(); mocks.permissions = ['moderation:dashboard', 'tour:list-all', 'dispute:resolve'];
  mocks.dashboard.mockReturnValue({ data: { generatedAt: '2026-11-04T00:00:00Z', queues: { toursPendingReview: 4, reportsOpen: 0, reportsAwaitingDecision: 0 }, tours: {} }, isLoading: false, isError: false, refetch: mocks.mainRetry });
  mocks.complaints.mockReturnValue({ isError: true, isLoading: false, refetch: mocks.complaintRetry });
});
afterEach(cleanup);
describe('KIEU dashboard regressions', () => {
  it('shows an isolated complaint error with retry while preserving the other queue metrics', () => {
    render(<ModerationDashboardPage />);
    expect(screen.getByTestId('tile-Tranh chấp khiếu nại').textContent).toBe('Lỗi tải dữ liệu');
    expect(screen.getByTestId('tile-Tour chờ duyệt').textContent).toBe('4');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(mocks.complaintRetry).toHaveBeenCalledTimes(1); expect(mocks.mainRetry).not.toHaveBeenCalled();
  });
  it('hides entire unauthorized widgets and skips the corresponding complaint query', () => {
    mocks.permissions = ['moderation:dashboard', 'tour:list-all'];
    render(<ModerationDashboardPage />);
    expect(screen.queryByTestId('tile-Tranh chấp khiếu nại')).toBeNull(); expect(screen.queryByTestId('tile-Báo cáo đang mở')).toBeNull();
    expect(mocks.complaints).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ skip: true }));
  });
  it('subscribes both dashboard data sources to hourly polling and focus revalidation', () => {
    render(<ModerationDashboardPage />);
    expect(mocks.dashboard).toHaveBeenCalledWith(undefined, expect.objectContaining({ pollingInterval: 3_600_000, refetchOnFocus: true }));
    expect(mocks.complaints).toHaveBeenCalledWith({ status: 'ESCALATED', limit: 1 }, expect.objectContaining({ pollingInterval: 3_600_000, refetchOnFocus: true }));
  });
});
