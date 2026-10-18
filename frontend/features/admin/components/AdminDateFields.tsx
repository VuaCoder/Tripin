'use client';
import { FormField, Input } from '@/components/ui';
import type { DateSelection } from '../utils/filters';

export function AdminDateFields({ value, onChange, prefix, disabled }: {
  value: DateSelection; onChange: (value: DateSelection) => void; prefix: string; disabled?: boolean;
}) {
  return <>
    <FormField label="Từ ngày" htmlFor={`${prefix}-from`}><Input id={`${prefix}-from`} type="date" value={value.from} max={value.to || undefined} disabled={disabled} onChange={(e) => onChange({ ...value, from: e.target.value })} /></FormField>
    <FormField label="Đến ngày" htmlFor={`${prefix}-to`}><Input id={`${prefix}-to`} type="date" value={value.to} min={value.from || undefined} disabled={disabled} onChange={(e) => onChange({ ...value, to: e.target.value })} /></FormField>
  </>;
}
