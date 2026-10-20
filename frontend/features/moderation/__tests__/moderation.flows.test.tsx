import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationReport, ModerationReview, ModerationTicket } from '../types';

const mockReports = vi.fn();
const mockReviews = vi.fn();
const mockTickets = vi.fn();
const mockTicket = vi.fn();
const mockResolve = vi.fn();
const mockModerate = vi.fn();
const mockReply = vi.fn();
const mockTicketStatus = vi.fn();
const mockBan = vi.fn();
let permissions: string[] = [];

vi.mock('../api/moderationApi', () => ({
  useGetModerationReportsQuery: (...a: unknown[]) => mockReports(...a),
  useGetModerationReviewsQuery: (...a: unknown[]) => mockReviews(...a),
  useGetModerationTicketsQuery: (...a: unknown[]) => mockTickets(...a),
  useGetModerationTicketQuery: (...a: unknown[]) => mockTicket(...a),
  useResolveReportMutation: () => [mockResolve, { isLoading: false }],
  useModerateReviewMutation: () => [mockModerate, { isLoading: false }],
  useReplyToModerationTicketMutation: () => [mockReply, { isLoading: false }],
  useSetModerationTicketStatusMutation: () => [mockTicketStatus, { isLoading: false }],
  useBanAccountMutation: () => [mockBan, { isLoading: false }],
}));
vi.mock('../components/ModerationUi', async (orig) => ({
  ...(await orig<typeof import('../components/ModerationUi')>()),
  useModerationPermission: (p: string) => permissions.includes(p),
}));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => ({ permissions }) }));
vi.mock('@/features/auth', () => ({ selectUser: () => null }));
vi.mock('@/features/review/components', () => ({ RatingStars: () => <span data-testid="stars" /> }));

import { ModerationReportListPage } from '../components/ModerationReportListPage';
import { ModerationReviewListPage } from '../components/ModerationReviewListPage';
import { ModerationTicketListPage } from '../components/ModerationTicketListPage';

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };
const q = (over: Record<string, unknown>) => ({
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  ...over,
});
const unwrapOk = () => ({ unwrap: () => Promise.resolve({}) });
const unwrapFail = (code: string) => ({ unwrap: () => Promise.reject({ data: { error: { code, message: 'x' } } }) });

const report = (over: Partial<ModerationReport> = {}): ModerationReport => ({
  id: 'r1',
  targetType: 'TOUR',
  targetId: 't1',
  targetName: 'Đà Nẵng 3N2Đ',
  category: 'SAFETY',
  description: 'Xe đưa đón không có dây an toàn.',
  status: 'OPEN',
  reporterId: 'u-reporter',
  reporterName: 'Nguyễn Văn An',
  agencyId: 'u-agency',
  agencyName: 'Saigon Travel',
  tourId: 't1',
  tourTitle: 'Đà Nẵng 3N2Đ',
  bookingId: 'b1',
  bookingCode: 'TRP-DEV002',
  createdAt: '2026-10-10T00:00:00.000Z',
  ...over,
});

const review = (over: Partial<ModerationReview> = {}): ModerationReview => ({
  id: 'v1',
  bookingId: 'b1',
  tourId: 't1',
  tourTitle: 'Đà Nẵng 3N2Đ',
  rating: 1,
  comment: 'Nội dung xúc phạm.',
  status: 'VISIBLE',
  travelerId: 'u-traveler',
  travelerName: 'Trần Thị B',
  agencyId: 'u-agency',
  agencyName: 'Saigon Travel',
  createdAt: '2026-10-10T00:00:00.000Z',
  ...over,
});

const ticket = (over: Partial<ModerationTicket> = {}): ModerationTicket => ({
  id: 's1',
  subject: 'Chưa nhận được vé',
  category: 'PAYMENT',
  status: 'OPEN',
  bookingId: 'b1',
  bookingCode: 'TRP-DEV001',
  messageCount: 1,
  lastMessageAt: '2026-10-10T00:00:00.000Z',
  createdAt: '2026-10-10T00:00:00.000Z',
  userId: 'u-traveler',
  userName: 'Trần Văn Khách',
  messages: [{ author: 'USER', text: 'Tôi đã trả tiền nhưng chưa có vé.', createdAt: '2026-10-10T00:00:00.000Z' }],
  ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  permissions = [];
});

describe('moderator permission scope', () => {
  it('denies the dispute queue without dispute:resolve and skips the request', () => {
    mockReports.mockReturnValue(q({}));
    render(<ModerationReportListPage />);
    expect(screen.getByRole('alert').textContent).toContain('không có quyền');
    expect(mockReports.mock.calls[0][1]).toEqual({ skip: true });
  });

  it('denies the review queue without review:moderate and skips the request', () => {
    mockReviews.mockReturnValue(q({}));
    render(<ModerationReviewListPage />);
    expect(screen.getByRole('alert').textContent).toContain('không có quyền');
    expect(mockReviews.mock.calls[0][1]).toEqual({ skip: true });
  });

  it('denies the complaint queue without complaint:handle and skips the request', () => {
    mockTickets.mockReturnValue(q({}));
    mockTicket.mockReturnValue(q({}));
    render(<ModerationTicketListPage />);
    expect(screen.getByRole('alert').textContent).toContain('không có quyền');
    expect(mockTickets.mock.calls[0][1]).toEqual({ skip: true });
  });
});

describe('ModerationReportListPage', () => {
  const allowResolve = () => (permissions = ['dispute:resolve']);

  it('renders loading, error and empty states', () => {
    allowResolve();
    mockReports.mockReturnValue(q({ isLoading: true }));
    const { rerender } = render(<ModerationReportListPage />);
    expect(screen.getByRole('status')).toBeTruthy();
    mockReports.mockReturnValue(q({ isError: true }));
    rerender(<ModerationReportListPage />);
    expect(screen.getByRole('alert').textContent).toContain('Không thể tải');
    mockReports.mockReturnValue(q({ data: { items: [], meta: { ...META, total: 0 } } }));
    rerender(<ModerationReportListPage />);
    expect(screen.getByText('Không có báo cáo nào')).toBeTruthy();
  });

  it('forwards every queue filter to the backend', () => {
    allowResolve();
    mockReports.mockReturnValue(q({ data: { items: [report()], meta: META } }));
    render(<ModerationReportListPage />);
    expect(mockReports).toHaveBeenLastCalledWith({ page: 1, limit: 10 }, { skip: false });

    fireEvent.change(screen.getByLabelText('Lọc theo trạng thái'), { target: { value: 'AGENCY_RESPONDED' } });
    expect(mockReports).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: 'AGENCY_RESPONDED' }, { skip: false });
    fireEvent.change(screen.getByLabelText('Lọc theo đối tượng'), { target: { value: 'USER' } });
    expect(mockReports).toHaveBeenLastCalledWith(
      { page: 1, limit: 10, status: 'AGENCY_RESPONDED', targetType: 'USER' },
      { skip: false },
    );
    fireEvent.change(screen.getByLabelText('Lọc theo loại vấn đề'), { target: { value: 'SAFETY' } });
    expect(mockReports).toHaveBeenLastCalledWith(
      { page: 1, limit: 10, status: 'AGENCY_RESPONDED', targetType: 'USER', category: 'SAFETY' },
      { skip: false },
    );
  });

  it('requires a note and does not call the backend without one', () => {
    allowResolve();
    mockReports.mockReturnValue(q({ data: { items: [report()], meta: META } }));
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.click(screen.getByText('Chấp nhận báo cáo'));

    expect(screen.getByText(/ít nhất 3 ký tự/)).toBeTruthy();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('shows the target, the reporter, the agency, the tour and the evidence booking by name instead of their ids', () => {
    allowResolve();
    mockReports.mockReturnValue(q({ data: { items: [report()], meta: META } }));
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));

    expect(screen.getByText('Nguyễn Văn An')).toBeTruthy();
    expect(screen.getByText('Saigon Travel')).toBeTruthy();
    expect(screen.getByText('Đà Nẵng 3N2Đ')).toBeTruthy(); // the related tour
    expect(screen.getByText(/^Tour · Đà Nẵng 3N2Đ$/)).toBeTruthy(); // and the target itself
    expect(screen.getByText('TRP-DEV002')).toBeTruthy(); // the booking offered as evidence, as its code
    expect(screen.queryByText('u-reporter')).toBeNull();
    expect(screen.queryByText('u-agency')).toBeNull();
    expect(screen.queryByText('t1')).toBeNull();
    expect(screen.queryByText('b1')).toBeNull();
  });

  it('resolves a dispute and reports success only after the backend confirms', async () => {
    allowResolve();
    mockReports.mockReturnValue(q({ data: { items: [report({ status: 'AGENCY_RESPONDED' })], meta: META } }));
    mockResolve.mockReturnValue(unwrapOk());
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.change(screen.getByLabelText(/Lý do \/ ghi chú xử lý/), { target: { value: 'Đã xác minh cùng đối tác' } });
    fireEvent.click(screen.getByText('Bác bỏ báo cáo'));

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith({ id: 'r1', decision: 'REJECTED', note: 'Đã xác minh cùng đối tác' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã bác bỏ báo cáo'));
  });

  it('keeps the dialog open, shows the mapped error and refetches when another moderator won the race', async () => {
    allowResolve();
    const refetch = vi.fn();
    mockReports.mockReturnValue(q({ data: { items: [report()], meta: META }, refetch }));
    mockResolve.mockReturnValue(unwrapFail('INVALID_STATE_TRANSITION'));
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.change(screen.getByLabelText(/Lý do \/ ghi chú xử lý/), { target: { value: 'Đã xử lý xong' } });
    fireEvent.click(screen.getByText('Chấp nhận báo cáo'));

    await waitFor(() => expect(screen.getAllByRole('alert')[0].textContent).toContain('Trạng thái hiện tại không cho phép'));
    expect(screen.queryByText(/Đã chấp nhận báo cáo/)).toBeNull();
    expect(refetch).toHaveBeenCalled();
  });

  it('offers the account ban only for a report about an account, and only with account:ban', async () => {
    permissions = ['dispute:resolve', 'account:ban'];
    mockReports.mockReturnValue(q({ data: { items: [report({ targetType: 'USER', targetId: 'u-violator' })], meta: META } }));
    mockBan.mockReturnValue(unwrapOk());
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.change(screen.getByLabelText(/Lý do \/ ghi chú xử lý/), { target: { value: 'Spam liên tục' } });
    fireEvent.click(screen.getByText('Khoá tài khoản bị báo cáo'));

    await waitFor(() => expect(mockBan).toHaveBeenCalledWith({ id: 'u-violator', reason: 'Spam liên tục' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã khoá tài khoản'));
  });

  it('hides the ban action for a tour report and without account:ban', () => {
    permissions = ['dispute:resolve'];
    mockReports.mockReturnValue(q({ data: { items: [report({ targetType: 'USER' })], meta: META } }));
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    expect(screen.queryByText('Khoá tài khoản bị báo cáo')).toBeNull();

    cleanup();
    permissions = ['dispute:resolve', 'account:ban'];
    mockReports.mockReturnValue(q({ data: { items: [report({ targetType: 'TOUR' })], meta: META } }));
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    expect(screen.queryByText('Khoá tài khoản bị báo cáo')).toBeNull();
  });

  it('shows the reported review and lets the moderator hide it without leaving the dialog', async () => {
    permissions = ['dispute:resolve', 'review:moderate'];
    mockReports.mockReturnValue(
      q({
        data: {
          items: [
            report({
              targetType: 'REVIEW',
              targetId: 'v1',
              agencyId: undefined,
              agencyName: undefined,
              review: { rating: 1, comment: 'Nội dung xúc phạm và sai sự thật.', status: 'VISIBLE', authorName: 'Lê Văn Vi Phạm' },
            }),
          ],
          meta: META,
        },
      }),
    );
    mockModerate.mockReturnValue(unwrapOk());
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));

    expect(screen.getByText('Nội dung xúc phạm và sai sự thật.')).toBeTruthy();
    expect(screen.getByText('Lê Văn Vi Phạm')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Lý do \/ ghi chú xử lý/), { target: { value: 'Xúc phạm, không có căn cứ' } });
    fireEvent.click(screen.getByText('Ẩn đánh giá'));

    await waitFor(() => expect(mockModerate).toHaveBeenCalledWith({ id: 'v1', hide: true, reason: 'Xúc phạm, không có căn cứ' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã ẩn đánh giá'));
  });

  it('offers the review action only with review:moderate, and restore for an already hidden review', () => {
    permissions = ['dispute:resolve'];
    mockReports.mockReturnValue(
      q({ data: { items: [report({ targetType: 'REVIEW', targetId: 'v1', review: { rating: 1, comment: 'x', status: 'VISIBLE' } })], meta: META } }),
    );
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    expect(screen.queryByText('Ẩn đánh giá')).toBeNull();

    cleanup();
    permissions = ['dispute:resolve', 'review:moderate'];
    mockReports.mockReturnValue(
      q({
        data: {
          items: [
            report({
              targetType: 'REVIEW',
              targetId: 'v1',
              review: { rating: 1, comment: 'x', status: 'HIDDEN', hiddenReason: 'Đã ẩn trước đó' },
            }),
          ],
          meta: META,
        },
      }),
    );
    render(<ModerationReportListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    expect(screen.getByText('Đã ẩn trước đó')).toBeTruthy();
    expect(screen.getByText('Khôi phục đánh giá')).toBeTruthy();
    expect(screen.queryByText('Ẩn đánh giá')).toBeNull();
  });
});

describe('ModerationReviewListPage', () => {
  it('requires a reason to hide and does not call the backend without one', () => {
    permissions = ['review:moderate'];
    mockReviews.mockReturnValue(q({ data: { items: [review()], meta: META } }));
    render(<ModerationReviewListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.click(screen.getByText('Ẩn đánh giá'));

    expect(screen.getByText(/ít nhất 3 ký tự/)).toBeTruthy();
    expect(mockModerate).not.toHaveBeenCalled();
  });

  it('shows the author, the agency and the tour by name instead of their ids', () => {
    permissions = ['review:moderate'];
    mockReviews.mockReturnValue(q({ data: { items: [review()], meta: META } }));
    render(<ModerationReviewListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));

    expect(screen.getAllByText('Trần Thị B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Saigon Travel').length).toBeGreaterThan(0);
    expect(screen.queryByText('u-traveler')).toBeNull();
    expect(screen.queryByText('u-agency')).toBeNull();
    expect(screen.queryByText('t1')).toBeNull();
  });

  it('hides a review with the reason the backend expects', async () => {
    permissions = ['review:moderate'];
    mockReviews.mockReturnValue(q({ data: { items: [review()], meta: META } }));
    mockModerate.mockReturnValue(unwrapOk());
    render(<ModerationReviewListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.change(screen.getByLabelText(/Lý do ẩn đánh giá/), { target: { value: 'Ngôn từ xúc phạm' } });
    fireEvent.click(screen.getByText('Ẩn đánh giá'));

    await waitFor(() => expect(mockModerate).toHaveBeenCalledWith({ id: 'v1', hide: true, reason: 'Ngôn từ xúc phạm' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã ẩn đánh giá'));
  });

  it('restores a hidden review without a reason', async () => {
    permissions = ['review:moderate'];
    mockReviews.mockReturnValue(q({ data: { items: [review({ status: 'HIDDEN', hiddenReason: 'Nhầm lẫn' })], meta: META } }));
    mockModerate.mockReturnValue(unwrapOk());
    render(<ModerationReviewListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    expect(screen.queryByText('Ẩn đánh giá')).toBeNull();
    fireEvent.click(screen.getByText('Khôi phục đánh giá'));

    await waitFor(() => expect(mockModerate).toHaveBeenCalledWith({ id: 'v1', hide: false }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã khôi phục đánh giá'));
  });

  it('bans the review author when the moderator holds account:ban', async () => {
    permissions = ['review:moderate', 'account:ban'];
    mockReviews.mockReturnValue(q({ data: { items: [review()], meta: META } }));
    mockBan.mockReturnValue(unwrapOk());
    render(<ModerationReviewListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.change(screen.getByLabelText(/Lý do ẩn đánh giá/), { target: { value: 'Tài khoản spam' } });
    fireEvent.click(screen.getByText('Khoá tài khoản tác giả'));

    await waitFor(() => expect(mockBan).toHaveBeenCalledWith({ id: 'u-traveler', reason: 'Tài khoản spam' }));
  });
});

describe('ModerationTicketListPage', () => {
  const allowHandle = () => {
    permissions = ['complaint:handle'];
    mockTickets.mockReturnValue(q({ data: { items: [ticket()], meta: META } }));
    mockTicket.mockReturnValue(q({ data: ticket() }));
  };

  it('blocks a too-short reply without calling the backend', () => {
    allowHandle();
    render(<ModerationTicketListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    expect(screen.getByText('Tôi đã trả tiền nhưng chưa có vé.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Trả lời du khách'), { target: { value: 'a' } });
    fireEvent.click(screen.getByText('Gửi trả lời'));

    expect(mockReply).not.toHaveBeenCalled();
    expect(screen.getByText(/ít nhất 2 ký tự/)).toBeTruthy();
  });

  it('replies and marks the ticket resolved in one call', async () => {
    allowHandle();
    mockReply.mockReturnValue(unwrapOk());
    render(<ModerationTicketListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.change(screen.getByLabelText('Trả lời du khách'), { target: { value: 'Chúng tôi đã gửi lại vé.' } });
    fireEvent.click(screen.getByLabelText(/Đánh dấu khiếu nại đã được giải quyết/));
    fireEvent.click(screen.getByText('Gửi trả lời'));

    await waitFor(() => expect(mockReply).toHaveBeenCalledWith({ id: 's1', text: 'Chúng tôi đã gửi lại vé.', resolve: true }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã gửi trả lời'));
  });

  it('claims an open ticket without a message', async () => {
    allowHandle();
    mockTicketStatus.mockReturnValue(unwrapOk());
    render(<ModerationTicketListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.click(screen.getByText('Tiếp nhận xử lý'));

    await waitFor(() => expect(mockTicketStatus).toHaveBeenCalledWith({ id: 's1', status: 'IN_PROGRESS' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã tiếp nhận xử lý'));
  });

  it('shows the backend error and no success message when the ticket was closed meanwhile', async () => {
    allowHandle();
    const refetch = vi.fn();
    mockTickets.mockReturnValue(q({ data: { items: [ticket()], meta: META }, refetch }));
    mockReply.mockReturnValue(unwrapFail('TICKET_CLOSED'));
    render(<ModerationTicketListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));
    fireEvent.change(screen.getByLabelText('Trả lời du khách'), { target: { value: 'Xin chào' } });
    fireEvent.click(screen.getByText('Gửi trả lời'));

    await waitFor(() => expect(screen.getAllByRole('alert')[0].textContent).toContain('đã đóng nên không thể trả lời'));
    expect(screen.queryByText(/Đã gửi trả lời/)).toBeNull();
    expect(refetch).toHaveBeenCalled();
  });

  it('offers a retry instead of an empty conversation when the detail read fails', () => {
    allowHandle();
    const refetch = vi.fn();
    mockTicket.mockReturnValue(q({ isError: true, refetch }));
    render(<ModerationTicketListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));

    expect(screen.getByText('Không thể tải khiếu nại')).toBeTruthy();
    fireEvent.click(screen.getByText('Thử lại'));
    expect(refetch).toHaveBeenCalled();
  });

  it('shows the sender, the related booking code and the assignee by name, never their ids', () => {
    allowHandle();
    mockTicket.mockReturnValue(q({ data: ticket({ assignedTo: 'm1', assignedToName: 'Nguyễn Kiểm Duyệt' }) }));
    render(<ModerationTicketListPage />);
    fireEvent.click(screen.getByText('Xem & xử lý'));

    expect(screen.getByText('Trần Văn Khách')).toBeTruthy();
    expect(screen.getByText('TRP-DEV001')).toBeTruthy();
    expect(screen.getByText('Nguyễn Kiểm Duyệt')).toBeTruthy();
    expect(screen.queryByText('u-traveler')).toBeNull();
    expect(screen.queryByText('b1')).toBeNull();
    expect(screen.queryByText('m1')).toBeNull();
  });

  it('offers no reply form for a resolved ticket', () => {
    allowHandle();
    mockTickets.mockReturnValue(q({ data: { items: [ticket({ status: 'RESOLVED' })], meta: META } }));
    mockTicket.mockReturnValue(q({ data: ticket({ status: 'RESOLVED' }) }));
    render(<ModerationTicketListPage />);
    fireEvent.click(screen.getByText('Xem chi tiết'));

    expect(screen.queryByText('Gửi trả lời')).toBeNull();
    expect(screen.queryByText('Tiếp nhận xử lý')).toBeNull();
  });
});
