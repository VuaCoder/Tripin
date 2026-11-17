'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { AntSelect } from '@/components/ui/AntSelect';
import { ArrowRight, Banknote, Building2, ChartColumn, CircleAlert, Percent, ReceiptText, Wallet } from 'lucide-react';
import { useFinanceDownloadMutation, type Overview, type Period } from './financeApi';
import s from './Finance.module.css';

export const money = (v: string | number | bigint) => new Intl.NumberFormat('vi-VN').format(BigInt(v || 0)) + ' đ';
export const date = (v: string | null | undefined) => v ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v)) : '—';
const labels: Record<string, string> = {
  SETTLED: 'Đã quyết toán', APPROVED: 'Đã duyệt',
  PAYMENT: 'Thanh toán', REFUND: 'Hoàn tiền', PAYOUT: 'Quyết toán', MATCHED: 'Khớp', DISCREPANCY: 'Chênh lệch', UNRECONCILED: 'Chưa đối soát',
  PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', COMPLETED: 'Hoàn thành', COMPLETED_WITH_ERRORS: 'Xong, có lỗi kết nối',
  CONFIRMED: 'Đã xác nhận', REJECTED: 'Đã từ chối', CANCELLED: 'Đã hủy', FAILED: 'Chuyển thất bại',
};

export function Badge({ value }: { value: string }) {
  const tone = ['MATCHED', 'CONFIRMED', 'APPROVED', 'SETTLED', 'COMPLETED'].includes(value) ? 'good' : ['DISCREPANCY', 'REJECTED', 'FAILED'].includes(value) ? 'bad' : ['PENDING', 'PROCESSING'].includes(value) ? 'warn' : '';
  return <span className={s.badge} data-tone={tone}>{labels[value] ?? value}</span>;
}

export const errorText = (e: unknown) => {
  const err = e as { data?: { error?: { message?: string }; message?: string } };
  return err?.data?.error?.message ?? err?.data?.message ?? 'Không thể thực hiện. Vui lòng thử lại.';
};

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  const periodId = useId();
  return <>
    <label htmlFor={periodId}>Kỳ báo cáo<AntSelect<Period['period']>
      id={periodId}
      value={value.period}
      onChange={period => onChange({ ...value, period })}
      size="large"
      className={s.periodSelect}
      popupMatchSelectWidth
      options={[
        { value: 'week', label: 'Tuần này' },
        { value: 'month', label: 'Tháng này' },
        { value: 'quarter', label: 'Quý này' },
        { value: 'custom', label: 'Tùy chọn ngày' },
      ]}
    /></label>
    {value.period === 'custom' && <>
      <label>Từ ngày<input type="date" required value={value.from ?? ''} onChange={e => onChange({ ...value, from: e.target.value })} /></label>
      <label>Đến ngày<input type="date" required value={value.to ?? ''} min={value.from} onChange={e => onChange({ ...value, to: e.target.value })} /></label>
    </>}
  </>;
}

export const validRange = (p: Period) => p.period !== 'custom' || !!(p.from && p.to && p.from <= p.to);

export function Metrics({ data, onPolicy, onReconcile }: { data: Overview; onPolicy?: () => void; onReconcile?: () => void }) {
  const metrics = [
    { label: 'Tổng giá trị đơn đã thu', value: data.gmv, Icon: Banknote },
    { label: 'Phần agency được hưởng', value: data.agencyEntitlement, Icon: Building2 },
    { label: 'Tiền chờ quyết toán', value: data.held, Icon: Wallet },
    { label: 'Hoa hồng tạm tính', value: data.commission, Icon: Percent },
  ];
  return <>
    <section className={s.summaryPanel} aria-label="Tổng quan tài chính">
      <dl className={s.metrics}>{metrics.map(({ label, value, Icon }) => <div className={s.metric} key={label}>
        <dt className={s.metricLabel}>{label}<Icon size={17} strokeWidth={1.6} aria-hidden="true" /></dt>
        <dd>{money(value)}</dd>
      </div>)}</dl>
      <div className={s.balances}>
        <span>Có thể quyết toán hiện tại <strong>{money(data.available)}</strong></span>
        <span>Đã chuyển trong kỳ <strong>{money(data.paidOut)}</strong></span>
      </div>
    </section>
    <FinanceWarnings data={data} onPolicy={onPolicy} onReconcile={onReconcile}/>
  </>;
}
export function FinanceWarnings({data,onReconcile}:{data:Overview;onPolicy?:()=>void;onReconcile?:()=>void}) {
  return <>
    {data.unresolvedReceipts>0&&<FinanceNotice onClick={onReconcile} icon={<CircleAlert size={16} aria-hidden="true"/>}>{data.unresolvedReceipts} khoản thu chưa khớp đối soát, chưa đủ điều kiện quyết toán.</FinanceNotice>}</>;
}

function FinanceNotice({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick?: () => void }) {
  return onClick ? <button type="button" className={`${s.notice} ${s.noticeAction}`} onClick={onClick}>{icon}<span>{children}</span><ArrowRight size={17} aria-hidden="true" /></button>
    : <p className={s.notice}>{icon}<span>{children}</span></p>;
}

export function Cashflow({ data }: { data: Overview }) {
  const max = data.cashflow.reduce((v, b) => BigInt(b.receipts) > v ? BigInt(b.receipts) : v, BigInt(1));
  return <section className={s.panel}>
    <div className={s.sectionTitle}>
      <h2>Thu tiền & hoa hồng</h2>
      {data.cashflow.length > 0 && <div className={s.legend}><span><i className={s.dot} />Khách thanh toán</span><span><i className={`${s.dot} ${s.dotFee}`} />Hoa hồng</span></div>}
    </div>
    {!data.cashflow.length ? <div className={s.chartEmpty}>
      <ChartColumn strokeWidth={1.5} aria-hidden="true" />
      <div><strong>Chưa có phát sinh trong kỳ</strong><p className={s.muted}>Biểu đồ sẽ xuất hiện khi có giao dịch được ghi nhận.</p></div>
    </div> : <>
      <div className={s.chart} role="group" aria-label="Biểu đồ số tiền thu và hoa hồng theo ngày">
        {data.cashflow.map(b => <Tooltip key={b.date} trigger={['hover', 'focus', 'click']} title={<div className={s.chartTooltip}>
          <strong>{date(`${b.date}T00:00:00+07:00`)}</strong>
          <span>Khách thanh toán <b>{money(b.receipts)}</b></span>
          <span>Hoa hồng <b>{money(b.commission)}</b></span>
        </div>}><button type="button" className={s.chartDay} aria-label={`${date(`${b.date}T00:00:00+07:00`)}: khách thanh toán ${money(b.receipts)}, hoa hồng ${money(b.commission)}`}>
          <div className={s.bars}>
            <div className={s.bar} style={{ height: `${Number(BigInt(b.receipts) * BigInt(100) / max)}%` }} />
            <div className={`${s.bar} ${s.barFee}`} style={{ height: `${Math.max(0, Number(BigInt(b.commission) * BigInt(100) / max))}%` }} />
          </div><span>{b.date.slice(8)}/{b.date.slice(5, 7)}</span>
        </button></Tooltip>)}
      </div>
      <details className={s.details}><summary>Xem số liệu theo ngày</summary><div className={s.tableWrap}>
        <table className={s.table}><thead><tr><th>Ngày</th><th>Thu</th><th>Hoàn từ sàn</th><th>Hoa hồng</th></tr></thead>
          <tbody>{data.cashflow.map(b => <tr key={b.date}><td>{date(`${b.date}T00:00:00+07:00`)}</td><td>{money(b.receipts)}</td><td>{money(b.refunds)}</td><td>{money(b.commission)}</td></tr>)}</tbody>
        </table>
      </div></details>
    </>}
  </section>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className={s.emptyState}><span className={s.emptyIcon}><ReceiptText size={23} strokeWidth={1.5} aria-hidden="true" /></span><strong>{title}</strong>{description && <p>{description}</p>}</div>;
}

export function FinanceError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return <div className={s.error} role="alert"><CircleAlert size={19} aria-hidden="true" /><span>{title}</span><button onClick={onRetry}>Thử lại</button></div>;
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  if (total <= 25) return null;
  return <nav className={s.pager} aria-label="Phân trang"><span>{total} kết quả</span><button disabled={page === 1} onClick={() => onPage(page - 1)}>Trang trước</button><span>Trang {page}/{Math.ceil(total / 25)}</span><button disabled={page * 25 >= total} onClick={() => onPage(page + 1)}>Trang sau</button></nav>;
}

export function Download({ url, name, label }: { url: string; name: string; label: string }) {
  const [download, state] = useFinanceDownloadMutation(), [error, setError] = useState('');
  return <><button disabled={state.isLoading} onClick={async () => {
    try {
      setError('');
      const r = await download({ url }).unwrap();
      const link = document.createElement('a');
      link.href = r.downloadUrl;
      link.download = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${r.extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) { setError(errorText(e)); }
  }}>{state.isLoading ? 'Đang tải…' : label}</button>{error && <span role="alert" className={s.error}>{error}</span>}</>;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function formatVndDigits(digits: string): string {
  const clean = digits.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!clean) return '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function MoneyInput({
  name,
  value,
  defaultValue = '',
  onChange,
  placeholder = '0',
  required,
  disabled,
  id,
  className,
  autoFocus,
  'aria-label': ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (rawDigits: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(
    defaultValue ? defaultValue.replace(/\D/g, '').replace(/^0+(?=\d)/, '') : ''
  );
  const rawValue = isControlled ? (value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '') : internalValue;

  const inputRef = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);
  const composing = useRef(false);

  const displayValue = formatVndDigits(rawValue);

  useIsomorphicLayoutEffect(() => {
    if (caretDigits.current === null || !inputRef.current) return;
    const input = inputRef.current;
    const digits = caretDigits.current;
    caretDigits.current = null;
    let position = 0;
    let count = 0;
    while (position < input.value.length && count < digits) {
      if (/\d/.test(input.value[position])) count++;
      position++;
    }
    if (input.value[position] === '.') position++;
    input.setSelectionRange(position, position);
  }, [displayValue]);

  const handleRawChange = (newRaw: string, caretPos?: number) => {
    const clean = newRaw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (caretPos !== undefined) {
      caretDigits.current = newRaw.slice(0, caretPos).replace(/\D/g, '').length;
    }
    if (!isControlled) {
      setInternalValue(clean);
    }
    onChange?.(clean);
  };

  return (
    <input
      ref={inputRef}
      name={name}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      value={displayValue}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' && inputRef.current) {
          const { selectionStart, selectionEnd } = inputRef.current;
          if (selectionStart !== null && selectionStart === selectionEnd && selectionStart > 1) {
            if (inputRef.current.value[selectionStart - 1] === '.') {
              e.preventDefault();
              const pos = selectionStart - 1;
              const val = inputRef.current.value;
              const nextVal = val.slice(0, pos - 1) + val.slice(pos);
              handleRawChange(nextVal, pos - 1);
            }
          }
        } else if (e.key === 'Delete' && inputRef.current) {
          const { selectionStart, selectionEnd } = inputRef.current;
          if (selectionStart !== null && selectionStart === selectionEnd && selectionStart < inputRef.current.value.length) {
            if (inputRef.current.value[selectionStart] === '.') {
              e.preventDefault();
              const val = inputRef.current.value;
              const nextVal = val.slice(0, selectionStart) + val.slice(selectionStart + 2);
              handleRawChange(nextVal, selectionStart);
            }
          }
        }
      }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={(e) => {
        composing.current = false;
        handleRawChange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length);
      }}
      onChange={(e) => {
        if (composing.current || (e.nativeEvent as InputEvent).isComposing) return;
        handleRawChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
      }}
      onBlur={(e) => {
        composing.current = false;
        handleRawChange(e.target.value);
      }}
    />
  );
}
