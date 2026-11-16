import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ allowed: true, agency: vi.fn(), agencies: vi.fn(), list: vi.fn(), detail: vi.fn() }));
vi.mock('../components/ModerationUi', () => ({ useModerationPermission: () => mock.allowed, ModerationDenied: () => <p role="alert">Không có quyền</p> }));
vi.mock('../api/completionReaderApi', () => ({ useCompletionAgencyQuery: mock.agency, useCompletionAgenciesQuery: mock.agencies, useCompletionReportsQuery: mock.list, useCompletionReportQuery: mock.detail }));
import { CompletionAgencyReportsPage, CompletionReportsPage } from '../components/CompletionReportsPage';
import { CompletionReportPage } from '../components/CompletionReportPage';

beforeEach(() => {
  mock.allowed = true; mock.list.mockReset(); mock.detail.mockReset();
  mock.agencies.mockReset();
  mock.agency.mockReset();
  const agencyA = { id: 'agency-a', name: 'Agency A', avatarUrl: 'https://res.cloudinary.com/test/avatar.jpg', address: 'Đà Nẵng', verified: true, reportCount: 1, lastCompletedAt: null };
  mock.agency.mockImplementation((id: string) => ({ currentData: { ...agencyA, id } }));
  mock.agencies.mockReturnValue({ currentData: { items: [agencyA, { id: 'agency-b', name: 'Agency B', avatarUrl: null, address: null, verified: false, reportCount: 0, lastCompletedAt: null }], total: 2, totalPages: 1 } });
  mock.list.mockReturnValue({ currentData: { items: [{ id: 'completion', tourId: 'tour', departureId: 'departure', coverImage: 'https://res.cloudinary.com/test/tour.jpg', destination: 'Đà Nẵng', durationDays: 2, endAt: '2026-01-03T08:00:00Z', bookingCount: 3, participants: 8, title: 'Tour Đà Nẵng', agencyName: 'Agency A', departureAt: '2026-01-01T08:00:00Z', completedAt: '2026-01-03T08:00:00Z', authorName: 'Quản lý', hasAmendment: true }], total: 1, totalPages: 1 } });
  mock.detail.mockReturnValue({ currentData: { agencyId: 'agency-a', title: 'Tour Đà Nẵng', agencyName: 'Agency A', durationDays: 2, departureAt: '2026-01-01T08:00:00Z', scheduledEndAt: '2026-01-03T08:00:00Z', completedAt: '2026-01-03T08:00:00Z', bookedParticipants: 50, itinerary: [],
    reports: [{ id: 'report', revision: 2, createdAt: '2026-01-03T08:00:00Z', authorName: 'Quản lý', actualEndAt: '2026-01-03T08:00:00Z', summary: 'Đã thực hiện đầy đủ lịch trình.', changes: '', incidents: 'Một khách vắng mặt.', evidence: ['https://example.com/evidence.jpg'], amendmentReason: '', bookingCount: 20, attendedCount: 49 }] } });
});
afterEach(cleanup);
describe('Moderator report reader', () => {
  it('shows agency identity cards linking to a separate report page', () => {
    render(<CompletionReportsPage />);
    expect(screen.getByRole('heading', { name: 'Tổng kết tour' })).toBeTruthy();
    expect(screen.getByText('Agency B')).toBeTruthy();
    expect(mock.list).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /Agency A/ }).getAttribute('href')).toBe('/moderator/tour-completions/agencies/agency-a');
    expect(screen.getByRole('link', { name: /Agency B/ }).getAttribute('href')).toBe('/moderator/tour-completions/agencies/agency-b');
    expect(screen.getByText('Agency đã xác minh')).toBeTruthy();
    expect(screen.getByText('Đà Nẵng')).toBeTruthy();
    const avatar = screen.getByRole('img', { name: 'Avatar Agency A' });
    fireEvent.error(avatar);
    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelector('details')).toBeNull();
  });
  it('opens an agency URL directly and scopes report filters to that agency', async () => {
    render(<CompletionAgencyReportsPage agencyId="agency-a" />);
    expect(mock.agency).toHaveBeenCalledWith('agency-a', expect.anything());
    expect(screen.getByRole('link', { name: 'Danh sách agency' }).getAttribute('href')).toBe('/moderator/tour-completions');
    expect(screen.getByRole('link', { name: 'Xem báo cáo' }).getAttribute('href')).toBe('/moderator/tour-completions/completion');
    expect(screen.getByRole('img', { name: 'Tour Đà Nẵng' }).getAttribute('src')).toBe('https://res.cloudinary.com/test/tour.jpg');
    expect(screen.getByText('3 booking · 8 khách')).toBeTruthy();
    expect(screen.getByText('Đã gửi báo cáo')).toBeTruthy();
    expect(screen.getByText(/Người gửi gần nhất: Quản lý/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.change(screen.getByLabelText('Tên tour'), { target: { value: 'Đà Nẵng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm báo cáo' }));
    await waitFor(() => expect(mock.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: 'Đà Nẵng', agencyId: 'agency-a' }), expect.anything()));
  });
  it('searches agencies and displays an agency without reports', async () => {
    mock.list.mockReturnValue({ currentData: { items: [], total: 0, totalPages: 0 } });
    render(<CompletionReportsPage />);
    fireEvent.change(screen.getByLabelText('Tên agency'), { target: { value: 'Agency B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm agency' }));
    expect(mock.agencies).toHaveBeenLastCalledWith({ page: 1, q: 'Agency B' }, expect.anything());
    cleanup();
    render(<CompletionAgencyReportsPage agencyId="agency-b" />);
    await screen.findByText('Chưa có báo cáo đã gửi phù hợp với bộ lọc.');
    expect(mock.list).toHaveBeenLastCalledWith({ page: 1, agencyId: 'agency-b' }, expect.anything());
  });
  it('paginates the full agency directory without loading all reports', () => {
    mock.agencies.mockReturnValue({ currentData: { items: [], total: 21, totalPages: 2 } });
    render(<CompletionReportsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(mock.agencies).toHaveBeenLastCalledWith({ page: 2 }, expect.anything());
    expect(mock.list).not.toHaveBeenCalled();
  });
  it('shows submitted history and evidence with no edit, approve or submit controls', () => {
    const result = mock.detail();
    Object.assign(result.currentData.reports[0], { services: { transport: 'PROVIDED', guide: 'PROVIDED', entranceTickets: 'NOT_APPLICABLE' },
      bookedServices: [{ key: 'a', name: 'Suất ăn mua thêm', unit: 'suất', quantity: 3, bookingCount: 1 }], serviceConfirmations: [{ key: 'a', status: 'PROVIDED' }],
      absenceReason: 'Khách báo ốm, đã liên hệ và xử lý theo chính sách.', additionalNotes: 'Đã đối soát dịch vụ.' });
    render(<CompletionReportPage id="completion" />);
    expect(screen.getByText('Đã thực hiện đầy đủ lịch trình.')).toBeTruthy();
    expect(screen.getByText('Một khách vắng mặt.')).toBeTruthy();
    expect(screen.getByText('Khách báo ốm, đã liên hệ và xử lý theo chính sách.')).toBeTruthy();
    expect(screen.getByText('Đã đối soát dịch vụ.')).toBeTruthy();
    expect(screen.getAllByText('Đã cung cấp')).toHaveLength(1);
    expect(screen.getByText('Suất ăn mua thêm · 3 suất · 1 booking')).toBeTruthy();
    expect(screen.queryByText('Phương tiện di chuyển')).toBeNull();
    expect(screen.getByRole('link', { name: 'Xem minh chứng 1' }).getAttribute('href')).toBe('https://example.com/evidence.jpg');
    expect(screen.getByRole('link', { name: 'Báo cáo của agency' }).getAttribute('href')).toBe('/moderator/tour-completions/agencies/agency-a');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
  it('opens the correct report through a complaint booking reference', () => {
    render(<CompletionReportPage id="booking" byBooking />);
    expect(mock.detail).toHaveBeenCalledWith({ id: 'booking', byBooking: true }, expect.anything());
  });
  it('does not fetch data without view permission', () => {
    mock.allowed = false;
    render(<CompletionReportPage id="completion" />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(mock.detail).not.toHaveBeenCalled();
    cleanup();
    render(<CompletionReportsPage />);
    expect(mock.agencies).not.toHaveBeenCalled();
    cleanup();
    render(<CompletionAgencyReportsPage agencyId="agency-a" />);
    expect(mock.agency).not.toHaveBeenCalled();
  });
  it('shows an error instead of loading reports for an unknown agency', () => {
    mock.agency.mockReturnValue({ error: { status: 404 } });
    render(<CompletionAgencyReportsPage agencyId="unknown" />);
    expect(screen.getByRole('alert').textContent).toContain('Không tìm thấy agency');
    expect(mock.list).not.toHaveBeenCalled();
  });
});
