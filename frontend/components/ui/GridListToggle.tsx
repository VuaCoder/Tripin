'use client';

import { LayoutGrid, List } from 'lucide-react';

export function GridListToggle({ value, onChange }: { value: 'grid' | 'list'; onChange: (value: 'grid' | 'list') => void }) {
  return (
    <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs" role="group" aria-label="Kiểu hiển thị">
      <button type="button" aria-label="Xem dạng lưới" title="Xem dạng lưới" aria-pressed={value === 'grid'} onClick={() => onChange('grid')} className={`flex size-9 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${value === 'grid' ? 'bg-brand-teal text-white' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutGrid className="size-4" aria-hidden="true" /></button>
      <button type="button" aria-label="Xem dạng danh sách" title="Xem dạng danh sách" aria-pressed={value === 'list'} onClick={() => onChange('list')} className={`flex size-9 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${value === 'list' ? 'bg-brand-teal text-white' : 'text-slate-500 hover:bg-slate-50'}`}><List className="size-4" aria-hidden="true" /></button>
    </div>
  );
}
