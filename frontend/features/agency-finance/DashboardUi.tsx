'use client';
import { Tooltip } from 'antd';
import { EmptyState,money } from './FinanceUi';
import type { Dashboard } from './walletApi';
import s from './Finance.module.css';
export function DashboardFigures({data}:{data:Dashboard}) {
  return <><section className={s.summaryPanel} aria-label="Phát sinh trong kỳ"><dl className={s.metrics}>
    {([['Khách thực thu',data.gmv],['Hoa hồng đã ghi nhận',data.earnedCommission],['Mới quyết toán',data.released],['Đã chuyển ngân hàng',data.paid]]).map(([label,value])=><div className={s.metric} key={label}><dt className={s.metricLabel}>{label}</dt><dd>{money(value)}</dd></div>)}
  </dl></section><div className={s.twoColumns}>
    <section className={s.panel}><div className={s.sectionTitle}><h2>Thu tiền & chuyển Agency</h2><div className={s.legend}><span><i className={s.dot}/>Thực thu</span><span><i className={`${s.dot} ${s.dotFee}`}/>Đã chuyển</span></div></div><DailyChart rows={data.cashflow} fields={['receipts','paid']}/></section>
    <section className={s.panel}><h2>Hoa hồng tạm tính theo ngày</h2><p className={s.muted}>Phát sinh trong kỳ: {money(data.commission)}. Phần đã ghi nhận theo quyết toán được theo dõi riêng.</p><DailyChart rows={data.cashflow} fields={['commission']}/></section>
  </div><div className={s.twoColumns}>
    <section className={s.panel}><h2>Số dư tại cuối kỳ</h2><p className={s.muted}>Nghĩa vụ hiện còn với Agency, không phải số dư tài khoản ngân hàng.</p><AmountBars rows={([['Chờ quyết toán',data.balances.pending],['Có thể rút',data.balances.available],['Đang rút',data.balances.reserved],['Tạm giữ',data.balances.frozen]])}/></section>
    <section className={s.panel}><h2>Thời gian chờ quyết toán hiện tại</h2>{data.aging.length?<AmountBars rows={data.aging.map(r=>[r.age,r.amount])}/>:<EmptyState title="Không có khoản chờ trong nhóm dữ liệu này"/>}</section>
  </div></>;
}
function AmountBars({rows}:{rows:string[][]}) {
  const max=rows.reduce((a,r)=>BigInt(r[1])>a?BigInt(r[1]):a,BigInt(1));
  return <dl className={s.amountBars}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd><span aria-hidden="true"><i style={{width:`${BigInt(value)>BigInt(0)?Number(BigInt(value)*BigInt(100)/max):0}%`}}/></span></div>)}</dl>;
}
function DailyChart({rows,fields}:{rows:Dashboard['cashflow'];fields:('receipts'|'paid'|'commission')[]}) {
  const max=rows.reduce((a,r)=>fields.reduce((n,f)=>BigInt(r[f])>n?BigInt(r[f]):n,a),BigInt(1));
  if(!rows.length)return <EmptyState title="Chưa có phát sinh trong kỳ" description="Chọn kỳ hoặc nhóm dữ liệu khác để xem."/>;
  return <><div className={s.chart} role="group" aria-label="Biểu đồ theo ngày">{rows.map(row=><Tooltip key={row.date} trigger={['hover','focus','click']} title={<div className={s.chartTooltip}><strong>{row.date.split('-').reverse().join('/')}</strong>{fields.map(f=><span key={f}>{{receipts:'Thực thu',paid:'Đã chuyển',commission:'Hoa hồng'}[f]} <b>{money(row[f])}</b></span>)}</div>}>
    <button type="button" className={s.chartDay} aria-label={`${row.date}: ${fields.map(f=>`${f==='receipts'?'Thực thu':f==='paid'?'Đã chuyển':'Hoa hồng'} ${money(row[f])}`).join(', ')}`}><div className={s.bars}>{fields.map((field,i)=><div key={field} className={`${s.bar} ${i?s.barFee:''}`} style={{height:`${Number(BigInt(row[field])*BigInt(100)/max)}%`}}/>)}</div><span>{row.date.slice(8)}/{row.date.slice(5,7)}</span></button>
  </Tooltip>)}</div><details className={s.details}><summary>Xem số liệu theo ngày</summary><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Ngày</th>{fields.map(f=><th key={f}>{{receipts:'Thực thu',paid:'Đã chuyển',commission:'Hoa hồng'}[f]}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.date}><td>{row.date.split('-').reverse().join('/')}</td>{fields.map(f=><td key={f} className={s.money}>{money(row[f])}</td>)}</tr>)}</tbody></table></div></details></>;
}
