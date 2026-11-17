'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { AntSelect } from '@/components/ui/AntSelect';
import { CompletionAgencyIdentity } from '@/features/moderation/components/CompletionAgencyIdentity';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { useAccountingDashboardQuery,useFinanceDirectoryQuery,useWalletActionMutation,type Origin } from './walletApi';
import AdminReceiptPanel from './AdminReceiptPanel';
import { SettlementTermsButton } from './SettlementPolicy';
import { useFinanceDownloadMutation, type Period } from './financeApi';
import { PeriodFilter,FinanceError,EmptyState,errorText,date,validRange,money } from './FinanceUi';
import { DashboardFigures } from './DashboardUi';
import { WithdrawalList } from './WalletUi';
import s from './Finance.module.css';
export default function AdminFinancePage(){
  const user=useAppSelector(selectUser),params=useSearchParams();
  const [tab,setTab]=useState(['withdrawals','agencies'].includes(params.get('view')??'')?params.get('view')!:'overview'),[range,setRange]=useState<Period>({period:'month'}),[origin,setOrigin]=useState<Origin>('LIVE');
  const [q,setQ]=useState(''),[page,setPage]=useState(1),[filter,setFilter]=useState('ALL'),[error,setError]=useState(''),[withdrawStatus,setWithdrawStatus]=useState(''),[overdue,setOverdue]=useState(false);
  const allowed=user?.role==='SUPER_ADMIN';
  const stats=useAccountingDashboardQuery({range,origin},{skip:!allowed||!validRange(range),pollingInterval:30000});
  const agencies=useFinanceDirectoryQuery({q,page,filter,origin},{skip:!allowed||tab!=='agencies'});
  const [run,job]=useWalletActionMutation(),[download,downloading]=useFinanceDownloadMutation();
  const exportFile=async(format:'xlsx'|'pdf')=>{setError('');try{const r=await download({url:`/admin/finance/reports/export.${format}`,params:{...range,origin}}).unwrap();const a=document.createElement('a');a.href=r.downloadUrl;a.download=`ke-toan-toan-san.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(r.downloadUrl),1000);}catch(e){setError(errorText(e));}};
  if(!allowed)return <p>Bạn không có quyền truy cập tài chính nội bộ.</p>;
  return <main className={`${s.page} ${s.screen}`}>
    <header className={s.header}><div><h1>Kế toán & tài chính</h1><p className={s.muted}>Dòng tiền toàn sàn, quyết toán tự động và yêu cầu rút của Agency.</p></div><div className={s.actions}><SettlementTermsButton/><button onClick={()=>void stats.refetch()} disabled={!validRange(range)||stats.isFetching}><RefreshCw size={16}/>Làm mới</button><button disabled={downloading.isLoading||!validRange(range)} onClick={()=>void exportFile('xlsx')}>Excel</button><button disabled={downloading.isLoading||!validRange(range)} onClick={()=>void exportFile('pdf')}>PDF</button></div></header>
    {error&&<p className={s.error} role="alert">{error}</p>}
    <div className={s.toolbar}><div className={s.periodFields}><PeriodFilter value={range} onChange={setRange}/></div><label>Nguồn dữ liệu<AntSelect size="large" value={origin} onChange={v=>{setOrigin(v);setPage(1);}} options={[{value:'LIVE',label:'Đã xác minh'},{value:'UNKNOWN',label:'Chờ xác minh'}]}/></label></div>
    {origin==='UNKNOWN'&&<p className={s.notice}>Đang xem khoản thu chưa xác minh nguồn. Chưa đủ điều kiện quyết toán.</p>}
    <div className={s.tabs} role="tablist" aria-label="Kế toán quản trị">{[['overview','Tổng quan'],['agencies','Agency'],['withdrawals','Yêu cầu rút tiền'],['reconcile','Đối soát']].map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} onClick={()=>{setTab(key);setWithdrawStatus('');setOverdue(false);}}>{label}</button>)}</div>
    {tab==='overview'&&<section role="tabpanel" aria-label="Tổng quan kế toán">
      {!validRange(range)?<p className={s.notice}>Chọn đủ khoảng ngày báo cáo.</p>:stats.isError?<FinanceError title="Không tải được dashboard kế toán." onRetry={()=>void stats.refetch()}/>:!stats.currentData?<p className={s.empty} role="status">Đang tải số liệu…</p>:<>
        <div className={s.taskBar}><button onClick={()=>{setTab('withdrawals');setWithdrawStatus('PENDING');setOverdue(false);}}><strong>{stats.currentData.tasks.pending}</strong> yêu cầu chờ duyệt</button><button onClick={()=>{setTab('withdrawals');setWithdrawStatus('PROCESSING');setOverdue(false);}}><strong>{stats.currentData.tasks.processing}</strong> yêu cầu đang chuyển</button><button onClick={()=>{setTab('withdrawals');setWithdrawStatus('');setOverdue(true);}}><strong>{stats.currentData.tasks.overdue}</strong> yêu cầu quá hạn</button><button onClick={()=>{setTab('agencies');setFilter('UNVERIFIED_BANK');setPage(1);}}><strong>{stats.currentData.tasks.unverifiedBanks}</strong> ngân hàng chờ xác minh</button><button onClick={()=>setTab('reconcile')}><strong>{stats.currentData.tasks.unreconciled}</strong> khoản thu cần đối soát</button></div>
        <DashboardFigures data={stats.currentData}/>
        <section className={s.panel}><div className={s.sectionTitle}><h2>Tự động quyết toán</h2><button disabled={job.isLoading} onClick={async()=>{setError('');try{await run({url:'/admin/finance/jobs/retry'}).unwrap();}catch(e){setError(errorText(e));}}}>Kiểm tra lại hồ sơ</button></div><p className={s.muted}>Lần chạy thành công: {date(stats.currentData.worker?.lastSucceededAt)} · {stats.currentData.worker?.processed??0} hồ sơ ở lượt gần nhất.</p>{stats.currentData.worker?.lastError&&<p className={s.error}>{stats.currentData.worker.lastError}</p>}</section>
      </>}
    </section>}
    {tab==='agencies'&&<section role="tabpanel" aria-label="Danh sách Agency kế toán"><div className={s.toolbar}><label>Tên Agency<input value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder="Tìm doanh nghiệp"/></label><label>Lọc Agency<AntSelect size="large" value={filter} onChange={v=>{setFilter(v);setPage(1);}} options={[{value:'ALL',label:'Tất cả'},{value:'BALANCE',label:'Có số dư có thể rút'},{value:'WITHDRAWALS',label:'Có yêu cầu rút'},{value:'FROZEN',label:'Có tiền tạm giữ'},{value:'UNVERIFIED_BANK',label:'Ngân hàng chưa xác minh'}]}/></label></div>
      {agencies.isError?<FinanceError title="Không tải được danh sách Agency." onRetry={()=>void agencies.refetch()}/>:agencies.currentData?<><p className={s.muted}>{agencies.currentData.total} Agency phù hợp</p><div className={s.financeAgencyGrid}>{agencies.currentData.items.map(a=><Link key={a.id} className={s.financeAgencyCard} href={`/super-admin/finance/agencies/${a.id}`}><CompletionAgencyIdentity agency={a}/><div className={s.agencyCardBalances}><span>Có thể rút<strong>{money(a.available)}</strong></span><span>Chờ quyết toán<strong>{money(a.pending)}</strong></span></div><div className={s.sectionTitle}><span className={s.muted}>{a.requests} yêu cầu đang xử lý</span><strong>Xem kế toán</strong></div></Link>)}</div>{!agencies.currentData.items.length&&<EmptyState title="Không có Agency phù hợp"/>}{agencies.currentData.total>12&&<nav className={s.pager}><button disabled={page===1} onClick={()=>setPage(page-1)}>Trang trước</button><span>Trang {page}/{Math.ceil(agencies.currentData.total/12)}</span><button disabled={page*12>=agencies.currentData.total} onClick={()=>setPage(page+1)}>Trang sau</button></nav>}</>:<p className={s.empty} role="status">Đang tải Agency…</p>}
    </section>}
    {tab==='reconcile'&&<section className={s.panel} role="tabpanel" aria-label="Đối soát toàn sàn"><h2>Đối soát khoản thu</h2><AdminReceiptPanel/></section>}
    {tab==='withdrawals'&&<section className={s.panel} role="tabpanel" aria-label="Yêu cầu rút tiền"><h2>Xử lý yêu cầu rút</h2><WithdrawalList admin key={`${withdrawStatus}-${overdue}`} initialStatus={withdrawStatus} overdue={overdue} agencyId={params.get('agencyId')??undefined}/></section>}
  </main>;
}
