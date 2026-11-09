'use client';
import { useEffect, useState } from 'react';

export function GuestCountInput({ value, min = 0, max, onChange, label, disabled = false, className = '' }: {
  value: number; min?: number; max: number; onChange: (value: number) => void;
  label: string; disabled?: boolean; className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const number = Number(draft);
    const next = Number.isFinite(number) ? Math.max(min, Math.min(Math.max(min, max), Math.trunc(number))) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return <input type="number" inputMode="numeric" aria-label={label} min={min} max={max} step={1}
    disabled={disabled} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} className={className} />;
}
