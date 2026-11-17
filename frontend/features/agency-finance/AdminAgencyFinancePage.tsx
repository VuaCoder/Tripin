'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Modal } from 'antd';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { CompletionAgencyIdentity } from '@/features/moderation/components/CompletionAgencyIdentity';
import { useFinanceIdentityQuery,useWalletQuery,useWalletActionMutation } from './walletApi';
import { useFinanceAdminDetailQuery,useFinanceAdminBankMutation,useFinanceDownloadMutation } from './financeApi';
import AdminReceiptPanel from './AdminReceiptPanel';
import EarlySettlementDialog from './EarlySettlementDialog';
import { WalletSummary,SettlementList,WithdrawalList } from './WalletUi';
import { Badge,Download,FinanceError,date,money,errorText } from './FinanceUi';
import s from './Finance.module.css';
export default function AdminAgencyFinancePage({agencyId}:{agencyId:string}){
  const user=useAppSelector(selectUser),allowed=user?.role==='SUPER_ADMIN';
  const [release,setRelease]=useState(false),[notice,setNotice]=useState('');
  const [tab,setTab]=useState('settlements'),[error,setError]=useState(''),[bank,setBank]=useState<{accountNumber:string;accountHolder:string;bankName:string;version:number}|null>(null);
  const identity=useFinanceIdentityQuery(agencyId,{skip:!allowed}),wallet=useWalletQuery({agencyId,admin:true},{skip:!allowed,pollingInterval:30000});
  const detail=useFinanceAdminDetailQuery({agencyId,range:{period:'month'}},{skip:!allowed});
  const [readBank,bankState]=useFinanceAdminBankMutation(),[run,state]=useWalletActionMutation(),[download,downloading]=useFinanceDownloadMutation();
  if(!allowed)return <p>Bạn không có quyền truy cập tài chính nội bộ.</p>;
  return <main className={`${s.page} ${s.screen}`}><div className={s.toolbar}><Link href="/super-admin/finance?view=agencies" className={s.buttonLink}>Danh sách Agency</Link><div className={s.equalActions}><button disabled={downloading.isLoading} onClick={async()=>{try{const r=await download({url:'/admin/finance/reports/export.xlsx',params:{agencyId,period:'month'}}).unwrap();const a=document.createElement('a');a.href=r.downloadUrl;a.download='ke-toan-agency.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(r.downloadUrl),1000);}catch(e){setError(errorText(e));}}}>Xuất Excel tháng này</button><button type="button" className={s.primary} onClick={()=>{setNotice('');setRelease(true);}}>Quyết toán ngay</button></div></div>
    {identity.currentData?<section className={s.panel}><CompletionAgencyIdentity agency={identity.currentData} prominent/></section>:identity.isError?<FinanceError title="Không tải được Agency." onRetry={()=>void identity.refetch()}/>:<p role="status">Đang tải Agency…</p>}
    {wallet.currentData?<WalletSummary data={wallet.currentData}/>:wallet.isError?<FinanceError title="Không tải được số dư." onRetry={()=>void wallet.refetch()}/>:<p role="status">Đang tải số dư…</p>}
    {notice&&<p className={s.notice} role="status">{notice}</p>}
    {error&&<p className={s.error} role="alert">{error}</p>}
    <div className={s.tabs} role="tablist" aria-label="Kế toán Agency">{[['settlements','Quyết toán'],['withdrawals','Yêu cầu rút'],['reconcile','Đối soát'],['bank','Ngân hàng'],['history','Lịch sử & kỳ cũ']].map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
    <section className={s.panel} role="tabpanel">
      {tab==='settlements'&&<SettlementList agencyId={agencyId} admin/>}
      {tab==='withdrawals'&&<WithdrawalList agencyId={agencyId} admin/>}
      {tab==='reconcile'&&<AdminReceiptPanel agencyId={agencyId}/>}
      {tab==='bank'&&<><div className={s.sectionTitle}><h2>Tài khoản nhận tiền</h2>{detail.currentData?.bank&&<button disabled={bankState.isLoading} onClick={async()=>{setError('');try{const r=await readBank(agencyId).unwrap();setBank(r.data);}catch(e){setError(errorText(e));}}}>Kiểm tra & xác minh</button>}</div>{detail.isError?<FinanceError title="Không tải được ngân hàng." onRetry={()=>void detail.refetch()}/>:detail.currentData?.bank?<p>{detail.currentData.bank.bankName} · ****{detail.currentData.bank.last4} <Badge value={detail.currentData.bank.verifiedAt?'CONFIRMED':'PENDING'}/></p>:<p className={s.muted}>Agency chưa khai báo tài khoản nhận tiền.</p>}</>}
      {tab==='history'&&<><h2>Các kỳ chuyển tiền trước đây</h2><p className={s.muted}>Lịch sử được giữ nguyên, không cộng lại vào số dư có thể rút.</p><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Kỳ</th><th>Số tiền</th><th>Trạng thái</th><th>Chứng từ</th></tr></thead><tbody>{detail.currentData?.payouts.map(p=><tr key={p.id}><td>{date(p.periodStart)} – {date(p.periodEnd)}</td><td>{money(p.netPayoutAmount)}</td><td><Badge value={p.status}/>{p.status==='PENDING'&&<button disabled={state.isLoading} onClick={async()=>{try{await run({url:`/admin/finance/payouts/${p.id}/cancel`}).unwrap();void detail.refetch();}catch(e){setError(errorText(e));}}}>Hủy kỳ chưa chuyển</button>}</td><td>{p.proofId&&<Download url={`/admin/finance/documents/${p.proofId}`} name="chung-tu-cu" label="Tải chứng từ"/>}</td></tr>)}</tbody></table></div><h2>Lịch sử thao tác</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Ngày</th><th>Thao tác</th><th>Người thực hiện</th></tr></thead><tbody>{detail.currentData?.audit.map(a=><tr key={a.id}><td>{date(a.createdAt)}</td><td>{a.action}</td><td>{a.actorId ?? 'Hệ thống'}</td></tr>)}</tbody></table></div></>}
    </section>
    <Modal title="Kiểm tra tài khoản nhận tiền" open={!!bank} onCancel={()=>setBank(null)} footer={null} destroyOnClose><div className={`${s.page} ${s.form}`}>{bank&&<><p>{bank.bankName} · {bank.accountHolder}</p><p>Số tài khoản: <strong>{bank.accountNumber}</strong></p><p className={s.muted}>Đối chiếu thông tin Agency trước khi xác minh.</p>{error&&<p className={s.error}>{error}</p>}<button className={s.primary} disabled={state.isLoading} onClick={async()=>{try{await run({url:`/admin/finance/agencies/${agencyId}/bank-verify`,body:{expectedVersion:bank.version}}).unwrap();setBank(null);void detail.refetch();}catch(e){setError(errorText(e));}}}>Xác minh tài khoản</button></>}</div></Modal>
    {release&&<EarlySettlementDialog agencyId={agencyId} onClose={()=>setRelease(false)} onSuccess={result=>{setRelease(false);setNotice(`Đã quyết toán ${result.settled} khoản (${money(result.totalAmount)}). ${result.skipped} khoản chưa đủ điều kiện; ${result.failed} khoản xử lý lỗi.${result.alreadySettled ? ` ${result.alreadySettled} khoản đã được quyết toán trước đó.` : ''}`);}}/>}
  </main>;
}
