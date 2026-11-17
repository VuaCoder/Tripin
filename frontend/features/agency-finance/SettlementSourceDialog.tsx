'use client';
import { Modal } from 'antd';
import { useSettlementSourceQuery } from './walletApi';
import { Badge,date,money,FinanceError } from './FinanceUi';
import s from './Finance.module.css';
export default function SettlementSourceDialog({id,onClose}:{id:string|null;onClose:()=>void}){
  const q=useSettlementSourceQuery(id??'',{skip:!id,refetchOnMountOrArgChange:true});const data=q.currentData;
  return <Modal title="Đối chiếu nguồn quyết toán" open={!!id} onCancel={onClose} footer={null} destroyOnClose width={700}><div className={`${s.page} ${s.modalBody}`}>
    {q.isError?<FinanceError title="Không tải được thông tin nguồn." onRetry={()=>void q.refetch()}/>:q.isFetching||!data?<p role="status">Đang tải thông tin…</p>:<>
      <h2>{data.booking.bookingCode}</h2><p>{data.booking.tourTitle}</p><p className={s.muted}>{date(data.booking.departureDate)} – {date(data.booking.endDate)}</p>
      <dl className={s.amountBars}><div><dt>Khách thanh toán</dt><dd>{money(data.booking.totalAmount)}</dd></div><div><dt>Hoa hồng theo booking</dt><dd>{money(data.booking.commissionAmount)}</dd></div><div><dt>Phần Agency</dt><dd>{money(data.booking.agencyAmount)}</dd></div></dl>
      <section className={s.details}><h2>Nguồn thu</h2><p className={s.muted}>{data.origin==='LIVE'?'Đã xác minh nguồn':'Chưa xác minh nguồn'}</p>{data.receipts.map(r=><div key={r.paymentId} className={s.details}><Badge value={r.reconciliationStatus}/><p>Thực thu kiểm tra: {money(r.actualAmount)} · {date(r.checkedAt)}</p>{r.gatewayRef&&<p className={s.muted}>Tham chiếu ngân hàng: {r.gatewayRef}</p>}</div>)}</section>
      <section className={s.details}><h2>Báo cáo hoàn tất gần nhất</h2>{data.report?<><p className={s.muted}>{data.report.authorName} · {date(data.report.createdAt)} · Phiên bản {data.report.revision}</p><p style={{whiteSpace:'pre-wrap'}}>{data.report.summary}</p></>:<p className={s.muted}>Chưa có báo cáo đã gửi.</p>}</section>
      <p className={s.notice}>{data.policy.holdDays!==undefined?`Chính sách đã chốt: giữ ${data.policy.holdDays} ngày sau mốc hoàn tất.`:'Chưa chốt phiên bản chính sách.'}</p>
    </>}
  </div></Modal>;
}
