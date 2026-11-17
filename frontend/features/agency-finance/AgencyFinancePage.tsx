'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Modal } from 'antd';
import { CalendarDays, Download as DownloadIcon, RefreshCw } from 'lucide-react';
import { useAgencyContext } from '@/features/agency/agencyContext';
import { useFinanceOverviewQuery, useFinanceJournalsQuery, useFinanceReceiptsQuery, useFinancePayoutsQuery, useFinanceBankQuery, useFinanceRunsQuery, useFinanceActionMutation, useFinanceDownloadMutation, type Period } from './financeApi';
import { Badge, EmptyState, FinanceError, FinanceWarnings, Cashflow, PeriodFilter, Pager, Download, money, date, errorText, validRange } from './FinanceUi';
import s from './Finance.module.css';
import { AgencyWallet, SettlementList, WithdrawalList } from './WalletUi';
import { SettlementTermsButton } from './SettlementPolicy';
export default function AgencyFinancePage() {
    const ctx = useAgencyContext(), agencyId = ctx?.agencyId ?? '';
    const [range, setRange] = useState<Period>({ period: 'month' }), [tab, setTab] = useState('transactions'), [page, setPage] = useState(1), [search, setSearch] = useState(''), [filter, setFilter] = useState('');
    const [notice, setNotice] = useState(''), [error, setError] = useState(''), [bankOpen, setBankOpen] = useState(false);
    const [action, actionState] = useFinanceActionMutation(), [download, downloadState] = useFinanceDownloadMutation();
    const ready = !!agencyId && validRange(range), args = { agencyId, range, page, search };
    const stats = useFinanceOverviewQuery({ agencyId, range }, { skip: !ready });
    const journals = useFinanceJournalsQuery({ ...args, type: filter }, { skip: !ready || tab !== 'transactions' });
    const receipts = useFinanceReceiptsQuery({ ...args, reconciliationStatus: filter }, { skip: !ready || tab !== 'reconcile', pollingInterval: tab === 'reconcile' ? 15000 : 0 });
    const payouts = useFinancePayoutsQuery({ agencyId, range, page }, { skip: !ready || tab !== 'payouts' });
    const bank = useFinanceBankQuery(agencyId, { skip: !agencyId });
    const runs = useFinanceRunsQuery(agencyId, { skip: !agencyId || tab !== 'reconcile', pollingInterval: tab === 'reconcile' ? 5000 : 0 });
    useEffect(() => { const requested = new URLSearchParams(window.location.search).get('tab'); if (requested && ['transactions','reconcile','settlements','withdrawals','payouts'].includes(requested)) setTab(requested); }, []);
    const can = (p: string) => ctx?.permissions.includes(p) ?? false;
    useEffect(() => { setPage(1); setSearch(''); setFilter(''); setBankOpen(false); setError(''); setNotice(''); }, [agencyId]);
    const refresh = () => { if (!ready)
        return; void stats.refetch(); if (tab === 'transactions')
        void journals.refetch(); if (tab === 'reconcile') {
        void receipts.refetch();
        void runs.refetch();
    } if (tab === 'payouts')
        void payouts.refetch(); void bank.refetch(); };
    const openSection = (next: string) => {
        setTab(next); setPage(1); setFilter(''); setSearch('');
        requestAnimationFrame(() => {
            const panel = document.getElementById('agency-finance-panel');
            panel?.scrollIntoView?.({ block: 'start' });
            panel?.focus({ preventScroll: true });
        });
    };
    const current = tab === 'transactions' ? journals : tab === 'reconcile' ? receipts : payouts;
    const save = async (url: string, body?: unknown, method?: 'PUT') => { setError(''); setNotice(''); try {
        await action({ url, body, method }).unwrap();
        return true;
    }
    catch (e) {
        setError(errorText(e));
        return false;
    } };
    const exportFile = async (format: 'xlsx' | 'pdf') => { try {
        setError('');
        const r = await download({ url: `/agency/finance/reports/export.${format}`, params: range }).unwrap();
        const a = document.createElement('a');
        a.href = r.downloadUrl;
        a.download = `bao-cao-tai-chinh.${format}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    catch (e) {
        setError(errorText(e));
    } };
    return <main className={`${s.page} ${s.screen}`}>
    <header className={s.header}><div><h1>Kế toán & tài chính</h1><p className={s.muted}>Theo dõi tiền thu, hoàn tiền và quyết toán của doanh nghiệp.</p></div><div className={s.actions}><SettlementTermsButton/><button onClick={refresh} disabled={!ready || stats.isFetching}><RefreshCw size={15} aria-hidden="true"/> Làm mới</button>{can('agency:finance-export') && <><button disabled={!ready || downloadState.isLoading} onClick={() => void exportFile('xlsx')}><DownloadIcon size={15} aria-hidden="true"/> Excel</button><button disabled={!ready || downloadState.isLoading} onClick={() => void exportFile('pdf')}>PDF</button></>}</div></header>
    <div className={s.toolbar}><div className={s.periodFields}><PeriodFilter value={range} onChange={v => { setRange(v); setPage(1); }}/></div><span className={s.periodMeta}><CalendarDays size={15} aria-hidden="true"/>Theo giờ Việt Nam · VND</span></div>
    <AgencyWallet agencyId={agencyId} canWithdraw={can('agency:finance-withdraw')} onBank={() => window.location.assign('/agency/settings/bank-account')}/>
    {!validRange(range) && <p className={s.notice}>Chọn ngày bắt đầu và kết thúc để xem báo cáo.</p>}
    {error && <p className={s.error} role="alert">{error}</p>}{notice && <p className={s.notice} role="status">{notice}</p>}
    {stats.isError ? <FinanceError title="Không tải được số liệu tài chính." onRetry={refresh}/> : stats.isFetching ? <p className={s.empty} role="status">Đang tải số liệu…</p> : stats.currentData && <><FinanceWarnings data={stats.currentData} onReconcile={() => openSection('reconcile')} onPolicy={() => openSection('payouts')}/><Cashflow data={stats.currentData}/></>}
    <div className={s.workspace}><div role="tablist" aria-label="Nghiệp vụ kế toán" className={s.tabs}>{[['transactions', 'Giao dịch'], ['reconcile', 'Đối soát'], ['settlements', 'Quyết toán'], ['withdrawals', 'Rút tiền'], ['payouts', 'Ngân hàng & lịch sử']].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setPage(1); setFilter(''); setSearch(''); }}>{label}</button>)}</div>
    <section id="agency-finance-panel" tabIndex={-1} className={s.tabBody} role="tabpanel" aria-label={{ transactions: 'Giao dịch', reconcile: 'Đối soát', payouts: 'Ngân hàng & lịch sử', settlements: 'Quyết toán', withdrawals: 'Rút tiền' }[tab]}>
    {['transactions', 'reconcile'].includes(tab) && <div className={s.filters}><label>Mã booking<input value={search} placeholder="TRP-…" onChange={e => { setSearch(e.target.value); setPage(1); }}/></label><label>{tab === 'transactions' ? 'Loại giao dịch' : 'Trạng thái'}<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="">Tất cả</option>{(tab === 'transactions' ? [['PAYMENT', 'Thanh toán'], ['PAYOUT', 'Quyết toán']] : [['MATCHED', 'Khớp'], ['DISCREPANCY', 'Chênh lệch'], ['UNRECONCILED', 'Chưa đối soát']]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>{tab === 'reconcile' && can('agency:finance-reconcile') && <button className={s.primary} disabled={actionState.isLoading || runs.currentData?.some(r => ['PENDING', 'PROCESSING'].includes(r.status))} onClick={async () => { if (await save('/agency/finance/reconcile')) {
        setNotice('Đã xếp lịch đối soát. Hệ thống sẽ kiểm tra tối đa 100 khoản thu mỗi lượt.');
        void runs.refetch();
    } }}>Chạy đối soát tự động</button>}</div>}
    {tab === 'reconcile' && runs.currentData?.[0] && <p className={s.muted}>Lượt gần nhất: <Badge value={runs.currentData[0].status}/> · {runs.currentData[0].matched}/{runs.currentData[0].checked} khoản khớp · {runs.currentData[0].discrepancies} chênh lệch · {runs.currentData[0].errors} lỗi kết nối</p>}
    {tab === 'settlements' ? <SettlementList agencyId={agencyId}/> : tab === 'withdrawals' ? <WithdrawalList agencyId={agencyId} canCancel={can('agency:finance-withdraw')}/> : current.isError ? (stats.isError ? <EmptyState title="Danh sách chưa sẵn sàng" description="Tải lại dữ liệu để tiếp tục xem giao dịch."/> : <FinanceError title="Không thể tải danh sách." onRetry={refresh}/>) : current.isFetching ? <p className={s.empty} role="status">Đang tải…</p> : <>
    {tab === 'transactions' && <><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Ngày</th><th>Booking / nội dung</th><th>Loại</th><th className={s.money}>Số tiền</th></tr></thead><tbody>{journals.currentData?.items.map(r => <tr key={r.id}><td>{date(r.effectiveAt)}</td><td><span className={s.code}>{r.bookingCode ?? 'Quyết toán'}</span><p className={s.muted}>{r.description}</p><details className={s.details}><summary>Các vế ghi sổ</summary>{r.entries.map((e, i) => <p key={i} className={s.muted}>{({ PLATFORM_CASH: 'Tiền sàn', AGENCY_PAYABLE: 'Phải trả agency', PLATFORM_COMMISSION: 'Hoa hồng sàn' } as Record<string, string>)[e.account] ?? e.account}: Nợ {money(e.debit)} · Có {money(e.credit)}</p>)}</details></td><td><Badge value={r.type}/></td><td className={s.money}>{money(r.amount)}</td></tr>)}</tbody></table>{!journals.currentData?.items.length && <EmptyState title="Chưa có giao dịch phù hợp." description="Thử chọn kỳ báo cáo khác hoặc thay đổi bộ lọc."/>}</div><Pager page={page} total={journals.currentData?.total ?? 0} onPage={setPage}/></>}
    {tab === 'reconcile' && <><p className={s.muted}>So khớp booking, mã PayOS và tiền thực thu. Mã giao dịch ngân hàng được lưu riêng.</p><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Booking / PayOS</th><th className={s.money}>Cần thu</th><th className={s.money}>Thực thu kiểm tra</th><th>Đối soát</th></tr></thead><tbody>{receipts.currentData?.items.map(r => <tr key={r.paymentId}><td><span className={s.code}>{r.booking.bookingCode}</span><p className={s.muted}>{r.payment.provider} · {r.payment.providerOrderCode}</p><p className={s.muted}>{r.gatewayRef ?? 'Chưa có mã ngân hàng'}</p></td><td className={s.money}>{money(r.amount)}</td><td className={s.money}>{r.checkedAt ? money(r.actualAmount) : 'Chưa kiểm tra'}</td><td><Badge value={r.reconciliationStatus}/>{r.reason&&<p className={s.muted}>{reasonLabel(r.reason)}</p>}{r.checkedAt&&<p className={s.muted}>{date(r.checkedAt)}</p>}</td></tr>)}</tbody></table>{!receipts.currentData?.items.length && <EmptyState title="Chưa có khoản thu phù hợp." description="Các khoản thanh toán sẽ xuất hiện tại đây để đối soát."/>}</div><Pager page={page} total={receipts.currentData?.total ?? 0} onPage={setPage}/></>}
    {tab === 'payouts' && <><section className={s.panel}><div className={s.sectionTitle}><h2>Tài khoản nhận tiền</h2><Link href="/agency/settings/bank-account" className={s.code}>Cấu hình tài khoản</Link>{can('agency:finance-bank-manage') && <button onClick={() => setBankOpen(true)}>{bank.currentData ? 'Cập nhật' : 'Thêm tài khoản'}</button>}</div>{bank.isError ? <p className={s.error}>Không tải được tài khoản ngân hàng.</p> : bank.isFetching ? <p>Đang tải…</p> : bank.currentData ? <p>{bank.currentData.bankName} · {bank.currentData.accountHolder} · ****{bank.currentData.last4} <Badge value={bank.currentData.verifiedAt ? 'CONFIRMED' : 'PENDING'}/></p> : <p className={s.muted}>Chưa có tài khoản nhận tiền.</p>}</section><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Kỳ quyết toán</th><th className={s.money}>Số tiền chuyển</th><th>Trạng thái</th><th>Chi tiết</th></tr></thead><tbody>{payouts.currentData?.items.map(p => <tr key={p.id}><td>{date(p.periodStart)} – {date(new Date(new Date(p.periodEnd).getTime() - 1).toISOString())}</td><td className={s.money}>{money(p.netPayoutAmount)}</td><td><Badge value={p.status}/><p className={s.muted}>{date(p.completedAt)}</p></td><td><details><summary className={s.code}>Xem bảng kê</summary>{p.items.map(i => <p key={i.id}>{i.booking.bookingCode} · {money(i.amount)}</p>)}<p>{p.bankSnapshot.bankName} · ****{p.bankSnapshot.last4}</p>{p.bankRef && <p>{p.bankRef}</p>}{p.proofId && <Download url={`/agency/finance/documents/${p.proofId}`} name="chung-tu-quyet-toan" label="Tải chứng từ"/>}</details></td></tr>)}</tbody></table>{!payouts.currentData?.items.length && <EmptyState title="Chưa có kỳ quyết toán trong khoảng ngày đã chọn." description="Thử chọn một kỳ báo cáo khác."/>}</div><Pager page={page} total={payouts.currentData?.total ?? 0} onPage={setPage}/></>}
    </>}
    </section></div>
    <Modal title="Tài khoản nhận quyết toán" open={bankOpen} onCancel={() => setBankOpen(false)} footer={null} destroyOnClose><div className={s.page}><form className={s.form} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (await save('/agency/finance/bank-account', { bankName: String(f.get('bankName')), accountHolder: String(f.get('accountHolder')), accountNumber: String(f.get('accountNumber')), expectedVersion: bank.currentData?.version ?? 0 }, 'PUT')) {
        setBankOpen(false);
        void bank.refetch();
        setNotice('Đã lưu tài khoản. Sàn sẽ xác minh trước khi quyết toán.');
    } }}><label>Ngân hàng<input name="bankName" required minLength={2} maxLength={100} defaultValue={bank.currentData?.bankName}/></label><label>Chủ tài khoản<input name="accountHolder" required minLength={2} maxLength={150} defaultValue={bank.currentData?.accountHolder}/></label><label>Số tài khoản<input name="accountNumber" onInput={event => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 30); }} inputMode="numeric" pattern="[0-9]{6,30}" required autoComplete="off"/></label>{error && <p role="alert" className={s.error}>{error}</p>}<button className={s.primary} disabled={actionState.isLoading}>Lưu tài khoản</button></form></div></Modal>
  </main>;
}
function reasonLabel(reason: string | null) { return reason ? ({ MULTIPLE_PAID_PAYMENTS: 'Booking có nhiều khoản đã thanh toán', BOOKING_AMOUNT_MISMATCH: 'Số tiền booking không khớp', PAYMENT_LINK_MISMATCH: 'Mã liên kết PayOS không khớp', AMOUNT_MISMATCH: 'Số tiền thực thu chênh lệch', GATEWAY_NOT_PAID: 'PayOS chưa ghi nhận đã trả', MISSING_TRANSACTION_EVIDENCE: 'Chưa đủ chi tiết giao dịch', PROVIDER_UNAVAILABLE: 'Không kết nối được cổng thanh toán' } as Record<string, string>)[reason] ?? 'Cần kiểm tra thêm' : ''; }
