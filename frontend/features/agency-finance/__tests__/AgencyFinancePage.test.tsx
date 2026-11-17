import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permissions: ['agency:finance-export', 'agency:finance-reconcile', 'agency:finance-refund-record', 'agency:finance-bank-manage'], overview: {}, overviewError: false, journals: vi.fn(), action: vi.fn(), upload: vi.fn() }));
vi.mock('@/features/agency/agencyContext', () => ({ useAgencyContext: () => ({ agencyId: 'agency-1', permissions: mocks.permissions }) }));
vi.mock('antd', async () => ({ ...await vi.importActual<typeof import('antd')>('antd'), Modal: ({ open, title, children }: {
        open: boolean;
        title: string;
        children: React.ReactNode;
    }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
vi.mock('../walletApi', () => ({
  useWalletQuery: () => ({currentData:{pending:'0',available:'0',reserved:'0',frozen:'0',total:'0',bankVerified:false,policy:null},refetch:vi.fn()}),
  useWalletActionMutation: () => [mocks.action, {}],
  useSettlementsQuery: () => ({currentData:{items:[],total:0},refetch:vi.fn()}),
  useWithdrawalsQuery: () => ({currentData:{items:[],total:0},refetch:vi.fn()}),
}));
vi.mock('../financeApi', () => ({
    useFinanceOverviewQuery: () => ({ currentData: mocks.overview, isError: mocks.overviewError, refetch: vi.fn() }),
    useFinanceJournalsQuery: (...args: unknown[]) => { mocks.journals(...args); return { currentData: { items: [], total: 0 }, refetch: vi.fn() }; },
    useFinanceReceiptsQuery: () => ({ currentData: { items: [], total: 0 }, refetch: vi.fn() }),
    useFinanceRefundsQuery: () => ({ currentData: [{ id: 'booking-1', bookingCode: 'TRP-TEST', tourTitle: 'Tour test', approvedAmount: '2000000', recordedAmount: '0', confirmedAmount: '0', financeRefunds: [] }], refetch: vi.fn() }),
    useFinancePayoutsQuery: () => ({ currentData: { items: [], total: 0 }, refetch: vi.fn() }),
    useFinanceBankQuery: () => ({ currentData: null, refetch: vi.fn() }), useFinanceRunsQuery: () => ({ currentData: [], refetch: vi.fn() }),
    useFinanceActionMutation: () => [mocks.action, {}], useFinanceUploadMutation: () => [mocks.upload, {}], useFinanceDownloadMutation: () => [vi.fn(), {}],
}));
import AgencyFinancePage from '../AgencyFinancePage';
import { money, PeriodFilter } from '../FinanceUi';
beforeEach(() => { mocks.permissions = ['agency:finance-export', 'agency:finance-reconcile', 'agency:finance-refund-record', 'agency:finance-bank-manage']; mocks.overview = { gmv: '10000000', commission: '1000000', agencyEntitlement: '9000000', held: '9000000', available: '0', paidOut: '0', openingBalance: '0', closingBalance: '9000000', refundLiability: '2000000', unresolvedReceipts: 1, policyConfigured: false, cashflow: [] }; mocks.overviewError = false; mocks.journals.mockClear(); mocks.action.mockReset().mockReturnValue({ unwrap: async () => ({ data: {} }) }); mocks.upload.mockReset().mockReturnValue({ unwrap: async () => ({ data: { id: 'proof-1' } }) }); });
afterEach(cleanup);
describe('Agency accounting workflows', () => {
    it('does not expose the deferred accounting refund workflow', () => {
        render(<AgencyFinancePage />);
        expect(screen.queryByRole('tab', { name: 'Hoàn tiền' })).toBeNull();
        expect(screen.queryByText('Còn phải hoàn khách')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Ghi nhận hoàn tiền' })).toBeNull();
    });
    it('opens the relevant work area from finance warnings', () => {
        render(<AgencyFinancePage />);
        fireEvent.click(screen.getByRole('button', { name: /1 khoản thu chưa khớp/ }));
        expect(screen.getByRole('tab', { name: 'Đối soát' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('button', { name: 'Chạy đối soát tự động' })).toBeTruthy();

    });
    it('shows exact daily receipt and commission amounts on chart focus', async () => {
        mocks.overview = { ...mocks.overview, cashflow: [{ date: '2026-11-11', receipts: '6000000', commission: '600000', refunds: '0' }] };
        render(<AgencyFinancePage />);
        fireEvent.focus(screen.getByRole('button', { name: /khách thanh toán 6.000.000 đ, hoa hồng 600.000 đ/ }));
        await waitFor(() => expect(screen.getByRole('tooltip').textContent).toContain('6.000.000 đ'));
        expect(screen.getByRole('tooltip').textContent).toContain('600.000 đ');
    });
    it('shows unavailable policy and unreconciled cash honestly instead of spendable money', () => { render(<AgencyFinancePage />);  expect(screen.getByText(/1 khoản thu chưa khớp/)).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Trang sau' })).toBeNull(); });
    it('does not show privileged export or refund controls without the corresponding grant', () => { mocks.permissions = []; render(<AgencyFinancePage />); expect(screen.queryByRole('button', { name: 'Excel' })).toBeNull(); expect(screen.queryByRole('tab', { name: 'Hoàn tiền' })).toBeNull(); });
    it('shows a fetch failure without manufacturing zero-valued finance cards', () => { mocks.overviewError = true; render(<AgencyFinancePage />); expect(screen.getByText(/Không tải được số liệu tài chính/)).toBeTruthy(); expect(screen.queryByText('Tổng giá trị đơn đã thu')).toBeNull(); });
    it('supports arbitrary precision display and custom range controls', () => { expect(money('10000000000000001')).toContain('10.000.000.000.000.001'); const change = vi.fn(); render(<PeriodFilter value={{ period: 'custom', from: '2026-11-01', to: '2026-11-17' }} onChange={change}/>); fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-18' } }); expect(change).toHaveBeenCalledWith({ period: 'custom', from: '2026-11-01', to: '2026-11-18' }); });
});
