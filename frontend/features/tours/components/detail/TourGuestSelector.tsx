'use client';
import { GuestCountInput } from '../GuestCountInput';
import { Minus, Plus } from 'lucide-react';
import { ageUnitPrice, guestTotal, type AgePricing, type GuestCounts } from '@travel-platform/constants';
import { formatVnd } from '@/features/review';
import styles from './tour-detail.module.css';
export function TourGuestSelector({ value, onChange, max, unitPrice, pricing, disabled = false }: { value: GuestCounts; onChange: (next: GuestCounts) => void; max: number; unitPrice: number; pricing?: AgePricing | null; disabled?: boolean }) {
  const rows = [
    { key: 'adults' as const, label: 'Người lớn', age: 'Từ 13 tuổi trở lên', price: unitPrice },
    { key: 'children' as const, label: 'Trẻ em', age: 'Độ tuổi 2 - 12', price: ageUnitPrice(unitPrice, pricing, 'child') },
    { key: 'infants' as const, label: 'Em bé', age: 'Dưới 2 tuổi', price: ageUnitPrice(unitPrice, pricing, 'infant') },
  ].filter(row => row.price !== null);
  return <div role="group" aria-label="Số lượng hành khách">{rows.map(row => <div key={row.key} className={styles.guestRow}><div><strong>{row.label}</strong>{row.age && <small>{row.age}</small>}<small>{formatVnd(row.price!)}</small></div><div className={styles.counter}>
    <button type="button" aria-label={`Giảm ${row.label.toLowerCase()}`} disabled={disabled || value[row.key] <= (row.key === 'adults' ? 1 : 0)} onClick={() => onChange({ ...value, [row.key]: value[row.key] - 1 })}><Minus size={15} /></button><GuestCountInput label={row.label} min={row.key === 'adults' ? 1 : 0} max={Math.max(0, max - guestTotal(value) + value[row.key])} disabled={disabled} value={value[row.key]} className="w-12 bg-transparent text-center" onChange={n => onChange({ ...value, [row.key]: n })} /><button type="button" aria-label={`Tăng ${row.label.toLowerCase()}`} disabled={disabled || guestTotal(value) >= max} onClick={() => onChange({ ...value, [row.key]: value[row.key] + 1 })}><Plus size={15} /></button>
  </div></div>)}</div>;
}
