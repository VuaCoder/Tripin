import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MyReport } from '../types';

const mockCreate = vi.fn();
const mockReports = vi.fn();
let permissions: string[] = [];

vi.mock('../api/reportApi', () => ({
  useCreateReportMutation: () => [mockCreate, { isLoading: false }],
  useGetMyReportsQuery: (args: unknown) => mockReports(args),
}));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => ({ permissions }) }));
vi.mock('@/features/auth', () => ({ selectUser: () => null }));

import { MyReportsPage } from '../components/MyReportsPage';
import { ReportButton } from '../components/ReportButton';
import { validateReportDescription } from '../labels';

const META = { page: 1, limit: 10, total: 1, totalPages: 1 };

const queryResult = (overrides: Record<string, unknown>) => ({
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
  ...overrides,
});

const report = (over: Partial<MyReport> = {}): MyReport => ({
  id: 'r1',
  targetType: 'TOUR',
  targetId: 't1',
  category: 'SAFETY',
  description: 'Xe đưa đón không có dây an toàn.',
  status: 'OPEN',
  createdAt: '2026-10-10T00:00:00.000Z',
  ...over,
});

const unwrapOk = () => ({ unwrap: () => Promise.resolve(report()) });
const unwrapFail = (code: string) => ({ unwrap: () => Promise.reject({ status: 409, data: { error: { code, message: 'x' } } }) });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  permissions = [];
});

describe('validateReportDescription', () => {
  it('mirrors the backend 10..2000 rule', () => {
    expect(validateReportDescription('123456789')).toBeTruthy();
    expect(validateReportDescription('   123456789   ')).toBeTruthy();
    expect(validateReportDescription('1234567890')).toBeNull();
    expect(validateReportDescription('x'.repeat(2001))).toBeTruthy();
  });
});

describe('ReportButton', () => {
  it('is hidden without report:create (a guest, an agency or a moderator)', () => {
    render(<ReportButton targetType="TOUR" targetId="t1" />);
    expect(screen.queryByRole('button', { name: /Báo cáo/ })).toBeNull();
  });

  it('blocks a too-short description without calling the backend', () => {
    permissions = ['report:create'];
    render(<ReportButton targetType="TOUR" targetId="t1" targetLabel="Đà Nẵng 3N2Đ" />);
    fireEvent.click(screen.getByRole('button', { name: /Báo cáo/ }));
    expect(screen.getByText(/Đà Nẵng 3N2Đ/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Mô tả chi tiết'), { target: { value: 'ngắn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/ít nhất 10 ký tự/)).toBeTruthy();
  });

  it('sends the trimmed report and reports success only after the backend confirms', async () => {
    permissions = ['report:create'];
    mockCreate.mockReturnValue(unwrapOk());
    render(<ReportButton targetType="TOUR" targetId="t1" />);
    fireEvent.click(screen.getByRole('button', { name: /Báo cáo/ }));
    fireEvent.change(screen.getByLabelText('Loại vấn đề'), { target: { value: 'PAYMENT_OR_REFUND' } });
    fireEvent.change(screen.getByLabelText('Mô tả chi tiết'), { target: { value: '  Đã trả tiền nhưng không nhận được vé.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith({
      targetType: 'TOUR',
      targetId: 't1',
      category: 'PAYMENT_OR_REFUND',
      description: 'Đã trả tiền nhưng không nhận được vé.',
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã gửi báo cáo'));
    expect(screen.queryByLabelText('Mô tả chi tiết')).toBeNull();
  });

  it('shows the mapped backend error, no success banner, and keeps the dialog open', async () => {
    permissions = ['report:create'];
    mockCreate.mockReturnValue(unwrapFail('REPORT_ALREADY_OPEN'));
    render(<ReportButton targetType="TOUR" targetId="t1" />);
    fireEvent.click(screen.getByRole('button', { name: /Báo cáo/ }));
    fireEvent.change(screen.getByLabelText('Mô tả chi tiết'), { target: { value: 'Tour này có thông tin sai lệch.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('đã có một báo cáo đang mở'));
    expect(screen.queryByText(/Đã gửi báo cáo/)).toBeNull();
    expect(screen.getByLabelText('Mô tả chi tiết')).toBeTruthy();
  });
});

describe('MyReportsPage', () => {
  it('shows loading, error (with retry) and empty states', () => {
    mockReports.mockReturnValue(queryResult({ isLoading: true }));
    const first = render(<MyReportsPage />);
    expect(screen.getByRole('status')).toBeTruthy();
    first.unmount();

    const refetch = vi.fn();
    mockReports.mockReturnValue(queryResult({ isError: true, refetch }));
    const second = render(<MyReportsPage />);
    fireEvent.click(screen.getByText('Thử lại'));
    expect(refetch).toHaveBeenCalled();
    second.unmount();

    mockReports.mockReturnValue(queryResult({ data: { items: [], meta: { ...META, total: 0 } } }));
    render(<MyReportsPage />);
    expect(screen.getByText('Chưa có báo cáo nào')).toBeTruthy();
  });

  it('shows the agency response and the moderator decision the backend returned', () => {
    mockReports.mockReturnValue(
      queryResult({
        data: {
          items: [
            report({
              status: 'RESOLVED',
              agencyResponse: { text: 'Chúng tôi đã hoàn tiền.', respondedAt: '2026-10-11T00:00:00.000Z' },
              resolution: { decision: 'RESOLVED', note: 'Đã xác minh và xử lý.', resolvedAt: '2026-10-12T00:00:00.000Z' },
            }),
          ],
          meta: META,
        },
      }),
    );
    render(<MyReportsPage />);
    expect(screen.getByText('Xe đưa đón không có dây an toàn.')).toBeTruthy();
    expect(screen.getByText('Chúng tôi đã hoàn tiền.')).toBeTruthy();
    expect(screen.getByText('Đã xác minh và xử lý.')).toBeTruthy();
    expect(screen.getAllByText('Đã giải quyết').length).toBeGreaterThan(1);
  });

  it('forwards the status filter and resets to page 1', () => {
    mockReports.mockReturnValue(queryResult({ data: { items: [report()], meta: META } }));
    render(<MyReportsPage />);
    expect(mockReports).toHaveBeenLastCalledWith({ page: 1, limit: 10 });
    fireEvent.change(screen.getByLabelText('Lọc theo trạng thái'), { target: { value: 'REJECTED' } });
    expect(mockReports).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: 'REJECTED' });
  });
});
