import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ query: {} as any, mark: vi.fn(), markAll: vi.fn(), remove: vi.fn(), refetch: vi.fn() }));
vi.mock('../notifications', () => ({
  useAgencyNotificationsQuery: () => ({ ...fixture.query, refetch: fixture.refetch }),
  useReadAgencyNotificationMutation: () => [fixture.mark, {}],
  useReadAllAgencyNotificationsMutation: () => [fixture.markAll, {}],
  useDeleteAgencyNotificationMutation: () => [fixture.remove, {}],
}));
vi.mock('../AgencyUi', () => ({
  agencyButton: '', dateTime: (date: string) => date,
  AgencyLoading: () => <p>Đang tải dữ liệu</p>,
  AgencyError: ({ message, retry }: any) => <div role="alert">{message}<button onClick={retry}>Thử lại</button></div>,
}));
vi.mock('@/features/tours/api/toursApi', () => ({ getTourApiMessage: (_error: unknown, message: string) => message }));
import AgencyNotificationsPage from '@/app/agency/notifications/page';

describe('Agency inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.query = { currentData: { data: [], meta: { page: 1, totalPages: 1, total: 0 } } };
  });
  afterEach(cleanup);
  it('shows a designed empty state, not invented activity', () => {
    render(<AgencyNotificationsPage />);
    expect(screen.getByText('Bạn đã cập nhật hết rồi')).toBeDefined();
    expect((screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('shows errors with retry instead of an empty inbox', () => {
    fixture.query = { error: { status: 403 } };
    render(<AgencyNotificationsPage />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.queryByText('Bạn đã cập nhật hết rồi')).toBeNull();
    fireEvent.click(screen.getByText('Thử lại'));
    expect(fixture.refetch).toHaveBeenCalledOnce();
  });
  it('preserves unread items when marking fails', async () => {
    fixture.query.currentData.data = [{ id: 'notification-1', title: 'Tour được duyệt', body: 'Nội dung', isRead: false, createdAt: '2026-10-16T00:00:00Z' }];
    fixture.mark.mockReturnValue({ unwrap: () => Promise.reject(new Error('Network')) });
    render(<AgencyNotificationsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('Chưa đọc')).toBeDefined();
    expect(fixture.mark).toHaveBeenCalledWith('notification-1');
  });
  it('keeps a notification visible when deletion fails and asks before removing it', async () => {
    fixture.query.currentData.data = [{ id: 'notification-1', title: 'Tour được duyệt', body: 'Nội dung', isRead: true, createdAt: '2026-10-16T00:00:00Z' }];
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.remove.mockReturnValue({ unwrap: () => Promise.reject(new Error('Network')) });
    render(<AgencyNotificationsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Xoá thông báo' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(fixture.remove).toHaveBeenCalledWith('notification-1');
    expect(screen.getByText('Tour được duyệt')).toBeDefined();
    confirm.mockRestore();
  });
});
