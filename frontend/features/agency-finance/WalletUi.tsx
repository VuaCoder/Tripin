'use client';
import { useState } from 'react';
import { Modal } from 'antd';
import { RefreshCw } from 'lucide-react';
import { AntSelect } from '@/components/ui/AntSelect';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { useWalletQuery,useSettlementsQuery,useWithdrawalsQuery,useWalletActionMutation,type Wallet,type Withdrawal } from './walletApi';
import { useFinanceUploadMutation,useFinanceAdminBankMutation } from './financeApi';
import { Badge,Download,EmptyState,FinanceError,MoneyInput,Pager,date,money,errorText } from './FinanceUi';
import s from './Finance.module.css';
import SettlementSourceDialog from './SettlementSourceDialog';

export function WalletSummary({data,onWithdraw,canWithdraw=false}:{data:Wallet;onWithdraw?:()=>void;canWithdraw?:boolean}) {
  return <section className={s.summaryPanel} aria-label="Số dư Agency"><dl className={s.metrics}>
    {([['Chờ quyết toán',data.pending],['Có thể rút',data.available],['Đang rút',data.reserved],['Tạm giữ',data.frozen]]).map(([label,value])=><div className={s.metric} key={label}><dt className={s.metricLabel}>{label}</dt><dd>{money(value)}</dd></div>)}
  </dl><div className={s.balances}><span>Số dư từ khoản thu đã xác minh</span>{canWithdraw&&<button className={s.primary} onClick={onWithdraw} disabled={!data.bankVerified||!data.policy||BigInt(data.available)<=BigInt(0)}>Yêu cầu rút tiền</button>}</div></section>;
}
export function AgencyWallet({agencyId,canWithdraw,onBank}:{agencyId:string;canWithdraw:boolean;onBank:()=>void}) {
  const q=useWalletQuery({agencyId},{skip:!agencyId,pollingInterval:30000});
  const [open,setOpen]=useState(false),[error,setError]=useState(''),[requestKey,setRequestKey]=useState('');
  const [run,state]=useWalletActionMutation();
  if(q.isError)return <FinanceError title="Không tải được số dư." onRetry={()=>void q.refetch()}/>;
  if(!q.currentData)return <p className={s.empty} role="status">Đang tải số dư…</p>;
  const data=q.currentData;
  return <><WalletSummary data={data} canWithdraw={canWithdraw} onWithdraw={()=>{setError('');setRequestKey(crypto.randomUUID());setOpen(true);}}/>
    {!data.bankVerified&&<button className={`${s.notice} ${s.noticeAction}`} onClick={onBank}>Tài khoản nhận tiền chưa xác minh. Xem thông tin ngân hàng.</button>}
    <Modal title="Yêu cầu rút tiền" open={open} onCancel={()=>{if(!state.isLoading)setOpen(false);}} footer={null} destroyOnClose>
      <form className={`${s.page} ${s.form}`} onSubmit={async e=>{
        e.preventDefault();
        const form=new FormData(e.currentTarget);
        setError('');
        const rawAmount=String(form.get('amount')??'').replace(/\D/g,'');
        if(!rawAmount||BigInt(rawAmount)<=BigInt(0)){
          setError('Vui lòng nhập số tiền muốn rút.');
          return;
        }
        const minWithdrawal=BigInt(data.policy?.minWithdrawal??'1');
        const maxWithdrawal=data.policy?.maxWithdrawal?BigInt(data.policy.maxWithdrawal):BigInt(data.available);
        const maxLimit=BigInt(data.available)<maxWithdrawal?BigInt(data.available):maxWithdrawal;
        if(BigInt(rawAmount)<minWithdrawal){
          setError(`Số tiền rút tối thiểu là ${money(minWithdrawal)}.`);
          return;
        }
        if(BigInt(rawAmount)>maxLimit){
          setError(`Số tiền rút không được vượt quá ${money(maxLimit)}.`);
          return;
        }
        try{
          await run({url:'/agency/finance/withdrawals',body:{amount:rawAmount,requestKey}}).unwrap();setOpen(false);
        }catch(err){setError(errorText(err));}
      }}>
        <p>Có thể rút: <strong>{money(data.available)}</strong></p>
        <p className={s.muted}>Tiền sẽ được dành riêng cho yêu cầu này. Admin kiểm tra và chuyển về tài khoản đã xác minh.</p>
        <label>Số tiền rút (VND)<MoneyInput name="amount" required placeholder="0"/></label>
        {data.policy&&<p className={s.muted}>Mỗi lần: {money(data.policy.minWithdrawal)} – {money(data.policy.maxWithdrawal)}. Mục tiêu xử lý: {data.policy.processingHours} giờ.</p>}
        {error&&<p className={s.error} role="alert">{error}</p>}
        <button className={s.primary} disabled={state.isLoading}>{state.isLoading?'Đang gửi…':'Xác nhận yêu cầu rút'}</button>
      </form>
    </Modal>
  </>;
}
export function SettlementList({agencyId,admin=false}:{agencyId:string;admin?:boolean}) {
  const [sourceId,setSourceId]=useState<string|null>(null);
  const [selected,setSelected]=useState<{id:string;hold:boolean}|null>(null),[error,setError]=useState('');const [run,state]=useWalletActionMutation();
  const [page,setPage]=useState(1);const q=useSettlementsQuery({agencyId,admin,page},{skip:!agencyId,pollingInterval:30000});
  if(q.isError)return <FinanceError title="Không tải được quyết toán." onRetry={()=>void q.refetch()}/>;
  if(q.isFetching&&!q.currentData)return <p className={s.empty} role="status">Đang tải quyết toán…</p>;
  return <><div className={s.tableWrap}><table className={`${s.table} ${s.settlementTable}`} data-admin={admin}><thead><tr><th>Booking / chuyến đi</th><th className={s.money}>Phần Agency</th><th>Dự kiến đủ điều kiện</th><th>Quyết toán</th>{admin&&<th>Thao tác</th>}</tr></thead><tbody>{q.currentData?.items.map(r=><tr key={r.id}>
    <td><strong>{r.booking?.bookingCode}</strong><p className={s.muted}>{r.booking?.tourTitle}</p>{r.origin==='UNKNOWN'&&<span className={s.badge}>Chưa xác minh nguồn</span>}</td>
    <td className={s.money}>{money(r.releasedAt?r.amount:r.booking?.agencyAmount??'0')}</td><td>{date(r.eligibleAt)}</td>
    <td><Badge value={r.releasedAt?'SETTLED':'PENDING'}/></td>{admin&&<td><div className={s.settlementActions}><button type="button" onClick={()=>setSourceId(r.id)}>Đối chiếu nguồn</button><button type="button" onClick={()=>{setError('');setSelected({id:r.id,hold:!r.reasons?.includes('MANUAL_HOLD')});}}>{r.reasons?.includes('MANUAL_HOLD')?'Bỏ giữ thủ công':'Tạm giữ'}</button></div></td>}
  </tr>)}</tbody></table>{!q.currentData?.items.length&&<EmptyState title="Chưa có hồ sơ quyết toán" description="Hệ thống sẽ tự kiểm tra các booking đã ghi nhận khoản thu."/>}</div><Pager page={page} total={q.currentData?.total??0} onPage={setPage}/>{admin&&<SettlementSourceDialog id={sourceId} onClose={()=>setSourceId(null)}/>}<Modal title={selected?.hold?'Tạm giữ khoản tiền':'Bỏ giữ thủ công'} open={!!selected} onCancel={()=>setSelected(null)} footer={null} destroyOnClose><form className={`${s.page} ${s.form}`} onSubmit={async e=>{e.preventDefault();if(!selected)return;const f=new FormData(e.currentTarget);try{await run({url:`/admin/finance/settlements/${selected.id}/hold`,body:{hold:selected.hold,note:String(f.get('note'))}}).unwrap();setSelected(null);}catch(err){setError(errorText(err));}}}><p className={s.muted}>Bỏ giữ thủ công không bỏ qua các điều kiện về nguồn thu, đối soát và tranh chấp.</p><label>Lý do<textarea name="note" required minLength={3} maxLength={1000}/></label>{error&&<p role="alert" className={s.error}>{error}</p>}<button className={s.primary} disabled={state.isLoading}>Lưu quyết định</button></form></Modal></>;
}
export function WithdrawalList({agencyId,admin=false,canCancel=false,initialStatus='',overdue=false}:{agencyId?:string;admin?:boolean;canCancel?:boolean;initialStatus?:string;overdue?:boolean}) {
  const user=useAppSelector(selectUser),[page,setPage]=useState(1),[status,setStatus]=useState(initialStatus);
  const q=useWithdrawalsQuery({agencyId,admin,page,status,overdue},{skip:!admin&&!agencyId,pollingInterval:30000});
  const [selected,setSelected]=useState<{row:Withdrawal;action:string}|null>(null),[error,setError]=useState('');
  const [run,state]=useWalletActionMutation(),[upload,uploadState]=useFinanceUploadMutation();
  const [readBank,bankState]=useFinanceAdminBankMutation(),[accountNumber,setAccountNumber]=useState('');
  const busy=state.isLoading||uploadState.isLoading;
  const pick=(row:Withdrawal,action:string)=>{setError('');setAccountNumber('');setSelected({row,action});};
  const names:Record<string,string>={approve:'Duyệt yêu cầu',process:'Nhận xử lý chuyển tiền',complete:'Xác nhận đã chuyển',reject:'Từ chối yêu cầu',cancel:'Hủy yêu cầu',fail:'Xác nhận chuyển thất bại'};
  return <>{overdue&&<p className={s.notice}>Các yêu cầu đang mở đã vượt thời gian xử lý theo chính sách.</p>}<div className={s.withdrawalToolbar}><label>Trạng thái<AntSelect size="large" className="w-full" value={status} onChange={v=>{setStatus(v);setPage(1);}} options={[{value:'',label:'Tất cả'},...Object.entries({PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',PROCESSING:'Đang chuyển',COMPLETED:'Đã chuyển',REJECTED:'Từ chối',CANCELLED:'Đã hủy',FAILED:'Chuyển thất bại'}).map(([value,label])=>({value,label}))]}/></label><button disabled={q.isFetching} onClick={()=>void q.refetch()}><RefreshCw size={15} className={q.isFetching?'animate-spin':''}/>{q.isFetching?'Đang tải…':'Làm mới'}</button></div>
    {q.isError?<FinanceError title="Không tải được yêu cầu rút." onRetry={()=>void q.refetch()}/>:<><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Yêu cầu / ngân hàng</th><th className={s.money}>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{q.currentData?.items.map(r=><tr key={r.id}>
      <td><strong>{r.id.slice(0,8).toUpperCase()}</strong><p className={s.muted}>{date(r.createdAt)} · {r.bankSnapshot.bankName} · ****{r.bankSnapshot.last4}</p><p className={s.muted}>{r.bankSnapshot.accountHolder}</p></td><td className={s.money}>{money(r.amount)}</td>
      <td><Badge value={r.status}/>{r.note&&<p className={s.muted}>{r.note}</p>}{r.bankRef&&<p className={s.muted}>{r.bankRef}</p>}</td>
      <td><div className={s.actions}>{admin?<>
        {r.status==='PENDING'&&<button disabled={r.requestedBy===user?.id} onClick={()=>pick(r,'approve')}>Duyệt</button>}
        {['PENDING','APPROVED'].includes(r.status)&&<button onClick={()=>pick(r,'reject')}>Từ chối</button>}
        {r.status==='APPROVED'&&<button onClick={()=>pick(r,'process')}>Nhận xử lý</button>}
        {r.status==='PROCESSING'&&r.processedBy===user?.id&&<><button onClick={()=>pick(r,'complete')}>Ghi nhận đã chuyển</button><button onClick={()=>pick(r,'fail')}>Chuyển thất bại</button></>}
      </>:r.status==='PENDING'&&canCancel&&<button onClick={()=>pick(r,'cancel')}>Hủy yêu cầu</button>}
      {r.proofId&&<Download url={`/${admin?'admin':'agency'}/finance/documents/${r.proofId}`} name="chung-tu-rut-tien" label="Tải chứng từ"/>}</div></td>
    </tr>)}{!q.currentData?.items.length&&<tr><td colSpan={4} className={s.withdrawalEmptyCell}>{q.isFetching?<p className={s.empty} role="status">Đang tải yêu cầu…</p>:<EmptyState title="Chưa có yêu cầu rút tiền" description={status?'Không có yêu cầu phù hợp với trạng thái đã chọn.':'Yêu cầu rút tiền của Agency sẽ hiển thị tại đây.'}/>}</td></tr>}</tbody></table></div><Pager page={page} total={q.currentData?.total??0} onPage={setPage}/></>}
    <Modal title={selected?names[selected.action]:''} open={!!selected} onCancel={()=>{if(!busy)setSelected(null);}} footer={null} destroyOnClose>
      {selected&&<form className={`${s.page} ${s.form}`} onSubmit={async e=>{e.preventDefault();setError('');const form=new FormData(e.currentTarget),file=(e.currentTarget.elements.namedItem('proof') as HTMLInputElement|null)?.files?.[0];try{
        let body:Record<string,string>={};const action=selected.action;
        if(form.get('note'))body.note=String(form.get('note'));
        if(['complete','fail'].includes(action)){
          if(!file||file.size>5*1024*1024)throw Error('Chọn chứng từ tối đa 5 MB.');
          const doc=await upload({url:`/admin/finance/agencies/${selected.row.agencyId}/documents`,file}).unwrap();
          body={...body,...(action==='complete'?{amount:String(form.get('amount')??'').replace(/\D/g,'')}:{}),proofId:doc.data.id,bankRef:String(form.get('bankRef')),transferredAt:new Date(String(form.get('transferredAt'))).toISOString()};
        }
        await run({url:`/${admin?'admin':'agency'}/finance/withdrawals/${selected.row.id}/${action}`,body}).unwrap();setSelected(null);
      }catch(err){setError(err instanceof Error?err.message:errorText(err));}}}>
        <p>Số tiền yêu cầu: <strong>{money(selected.row.amount)}</strong></p><p className={s.muted}>{selected.row.bankSnapshot.bankName} · {selected.row.bankSnapshot.accountHolder} · ****{selected.row.bankSnapshot.last4}</p>{admin&&<button type="button" disabled={bankState.isLoading} onClick={async()=>{try{const b=await readBank(selected.row.agencyId).unwrap();if(b.data.version!==selected.row.bankSnapshot.version){setError('Tài khoản ngân hàng đã thay đổi. Cần kiểm tra lại yêu cầu.');return;}setAccountNumber(b.data.accountNumber);}catch(err){setError(errorText(err));}}}>Xem số tài khoản nhận</button>}{accountNumber&&<p>Số tài khoản: <strong>{accountNumber}</strong></p>}
        {['complete','fail'].includes(selected.action)&&<><p className={s.notice}>{selected.action==='fail'?'Chỉ xác nhận thất bại khi có bằng chứng không chuyển thành công. Chưa rõ kết quả thì giữ trạng thái đang chuyển.':'Chỉ xác nhận sau khi kiểm tra tiền đã chuyển thành công.'}</p>
          {selected.action==='complete'&&<label>Số tiền chuyển (VND)<MoneyInput name="amount" required defaultValue={selected.row.amount}/></label>}
          <label>Mã giao dịch ngân hàng<input name="bankRef" required minLength={3} maxLength={150}/></label>
          <label>Thời điểm chuyển<input name="transferredAt" type="datetime-local" required/></label>
          <label>Chứng từ (PNG, JPG, PDF, tối đa 5 MB)<input name="proof" type="file" accept="image/png,image/jpeg,application/pdf" required/></label></>}
        {['reject','fail'].includes(selected.action)&&<label>Lý do<textarea name="note" required minLength={3} maxLength={1000}/></label>}
        {error&&<p role="alert" className={s.error}>{error}</p>}<button className={s.primary} disabled={busy}>{busy?'Đang xử lý…':names[selected.action]}</button>
      </form>}
    </Modal>
  </>;
}
