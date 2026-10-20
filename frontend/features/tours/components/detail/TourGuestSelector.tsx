'use client';
import { Minus, Plus } from 'lucide-react';
import { guestTotal, type AgePricing, type GuestCounts } from '@travel-platform/constants';
import { formatVnd } from '@/features/review';
import styles from './tour-detail.module.css';
export function TourGuestSelector({ value, onChange, max, unitPrice, pricing, disabled = false }: { value: GuestCounts; onChange: (next: GuestCounts) => void; max: number; unitPrice: number; pricing?: AgePricing | null; disabled?: boolean }) {
  const rows: Array<{ key: keyof GuestCounts; label: string; age?: string; rate: number }> = [
    { key: 'adults', label: pricing ? 'Người lớn' : 'Số khách', age: pricing ? `Từ ${pricing.adultMinAge} tuổi` : undefined, rate: 100 },
    ...(pricing ? [{ key: 'children' as const, label: 'Trẻ em', age: `${pricing.childMinAge} – dưới ${pricing.adultMinAge} tuổi`, rate: pricing.childPercent }, { key: 'infants' as const, label: 'Em bé', age: `Dưới ${pricing.childMinAge} tuổi`, rate: pricing.infantPercent }] : []),
  ];
  return <div role="group" aria-label="Số lượng hành khách">{rows.map(row => <div key={row.key} className={styles.guestRow}><div><strong>{row.label}</strong>{row.age && <small>{row.age}</small>}<small>{formatVnd(Math.round(unitPrice * row.rate / 100))}</small></div><div className={styles.counter}>
    <button type="button" aria-label={`Giảm ${row.label.toLowerCase()}`} disabled={disabled || value[row.key] <= (row.key === 'adults' ? 1 : 0)} onClick={() => onChange({ ...value, [row.key]: value[row.key] - 1 })}><Minus size={15} /></button><output aria-label={row.label}>{value[row.key]}</output><button type="button" aria-label={`Tăng ${row.label.toLowerCase()}`} disabled={disabled || guestTotal(value) >= max} onClick={() => onChange({ ...value, [row.key]: value[row.key] + 1 })}><Plus size={15} /></button>
  </div></div>)}</div>;
}
