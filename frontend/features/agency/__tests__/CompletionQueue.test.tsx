import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ query: vi.fn(), role: 'OWNER', allowed: true, params: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mock.params), useRouter: () => ({ replace: mock.replace }) }));
vi.mock('../AgencyCompletionReportModal', () => ({ AgencyCompletionReportModal: ({ scope, onClose }: any) => scope ? <div role="dialog" aria-label="Báo cáo chuyến đi"><p>{scope.tourId}:{scope.departureId}</p><button onClick={onClose}>Đóng báo cáo</button></div> : null }));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => ({ memberRole: mock.role }) }));
vi.mock('../AgencyCommon', async original => ({ ...await original<typeof import('../AgencyCommon')>(), useAgencyPermission: () => mock.allowed }));
vi.mock('../completionApi', () => ({ usePendingCompletionsQuery: mock.query }));
import Page from '@/app/agency/completions/page';

const row = { tourId: 'tour', departureId: 'departure', title: 'Tour test 8/10', coverImage: 'https://res.cloudinary.com/test/tour.jpg', destination: 'Đà Nẵng', durationDays: 2, departureAt: '2026-11-14T11:00:00Z', endAt: '2026-11-16T11:00:00Z', bookingCount: 3, participants: 8 };
beforeEach(() => {
  mock.role = 'OWNER'; mock.allowed = true; mock.params = ''; mock.replace.mockReset(); mock.query.mockReset();
  mock.query.mockImplementation(({ page, status }) => ({ currentData: { items: [{ ...row, ...(status === 'completed' ? { completedAt: '2026-11-17T00:00:00Z', hasReport: true } : {}) }], page, hasNext: false }, refetch: vi.fn() }));
});
afterEach(cleanup);
describe('Agency completion queue and history', () => {
  it('shows the tour cover and compact trip information, with a fallback for failed images', () => {
    render(<Page />);
    const image = screen.getByRole('img', { name: row.title });
    expect(image.getAttribute('src')).toBe(row.coverImage);
    expect(screen.getByText('Đà Nẵng')).toBeTruthy();
    expect(screen.getByText('3 booking · 8 khách')).toBeTruthy();
    expect(screen.queryByText(/Chỉ từ/)).toBeNull();
    fireEvent.error(image);
    expect(screen.getByText('Chưa có ảnh tour')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử hoàn tất' }));
    expect(screen.getByText('Đã gửi báo cáo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xem báo cáo & lịch sử' })).toBeTruthy();
  });
  it('switches from pending work to history with links to the selected departure report', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Lập báo cáo & hoàn tất' }));
    expect(screen.getByRole('dialog').textContent).toContain('tour:departure');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng báo cáo' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử hoàn tất' }));
    expect(mock.query).toHaveBeenLastCalledWith({ page: 1, status: 'completed' }, expect.anything());
    expect(screen.getByRole('button', { name: 'Xem báo cáo & lịch sử' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lập báo cáo & hoàn tất' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Lịch sử hoàn tất' }).getAttribute('aria-selected')).toBe('true');
  });
  it('resets pagination on tab change and hides pagination for a single page', () => {
    mock.query.mockImplementation(({ page }) => ({ currentData: { items: [row], page, hasNext: true }, refetch: vi.fn() }));
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(mock.query).toHaveBeenLastCalledWith({ page: 2, status: 'pending' }, expect.anything());
    fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử hoàn tất' }));
    expect(mock.query).toHaveBeenLastCalledWith({ page: 1, status: 'completed' }, expect.anything());
  });
  it('shows legacy completion without claiming a report exists', () => {
    mock.query.mockReturnValue({ currentData: { items: [{ ...row, hasReport: false }], hasNext: false }, refetch: vi.fn() });
    render(<Page />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử hoàn tất' }));
    expect(screen.getByText(/Hoàn tất theo luồng cũ/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xem chi tiết chuyến đi' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
  it('opens a notification deep link as a popup and removes its query when closed', () => {
    mock.params = 'tourId=tour&departureId=departure';
    render(<Page />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng báo cáo' }));
    expect(mock.replace).toHaveBeenCalledWith('/agency/completions', { scroll: false });
  });
  it('distinguishes empty history and skips fetching for staff', () => {
    mock.query.mockReturnValue({ currentData: { items: [], hasNext: false }, refetch: vi.fn() });
    const view = render(<Page />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử hoàn tất' }));
    expect(screen.getByText('Chưa có chuyến đi đã hoàn tất.')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    mock.role = 'STAFF'; view.rerender(<Page />);
    expect(mock.query).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ skip: true }));
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
