'use client';

import type { TourCategory, TourContentInput } from '../types';
import { formatCurrencyVndInput, parseCurrencyVndInput } from '../utils/format';
import { TourPolicyFields } from './TourPolicyFields';

type Props = { value: TourContentInput; onChange: (value: TourContentInput) => void; categories: TourCategory[] };

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 disabled:bg-slate-100 placeholder:font-normal placeholder:text-slate-400';

export function TourContentFields({ value, onChange, categories }: Props) {
  const set = <K extends keyof TourContentInput>(key: K, next: TourContentInput[K]) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-5">
      <TourPolicyFields value={value} onChange={onChange} />
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">Tên tour
          <input className={inputClass} minLength={5} maxLength={200} required value={value.title} onChange={(e) => set('title', e.target.value)} placeholder="Ví dụ: Cao nguyên đá Hà Giang mùa hoa tam giác mạch 4N3Đ" />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">Điểm đến
          <input className={inputClass} minLength={2} maxLength={120} required value={value.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Ví dụ: Hà Giang, Sa Pa, Đà Nẵng..." />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">Số ngày
          <input className={inputClass} type="number" min={1} max={365} required value={value.durationDays} onChange={(e) => set('durationDays', Number(e.target.value))} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">Giá cơ bản (VND)
          <input
            className={inputClass}
            type="text"
            inputMode="numeric"
            placeholder="Ví dụ: 1.500.000"
            required
            value={formatCurrencyVndInput(value.basePrice)}
            onChange={(e) => set('basePrice', parseCurrencyVndInput(e.target.value))}
          />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">Số khách tối đa
          <input className={inputClass} type="number" min={1} max={10000} value={value.maxGroupSize ?? ''} onChange={(e) => set('maxGroupSize', e.target.value ? Number(e.target.value) : undefined)} placeholder="Ví dụ: 25" />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Tóm tắt <span className="font-normal text-slate-500">(Optional)</span>
        <textarea className={inputClass} rows={2} maxLength={500} value={value.summary ?? ''} onChange={(e) => set('summary', e.target.value || undefined)} />
      </label>
      <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Mô tả chi tiết <span className="font-normal text-slate-500">(Optional)</span>
        <textarea className={inputClass} rows={5} maxLength={20000} value={value.description ?? ''} onChange={(e) => set('description', e.target.value || undefined)} />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Danh mục <span className="font-normal text-slate-500">(chọn từ 1 đến 10)</span></legend>
        {categories.length === 0 ? <p className="text-sm text-amber-700">Chưa tải được danh mục. Hãy thử tải lại trang.</p> : (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const selected = value.categoryIds.includes(category.id);
              return <label key={category.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm ${selected ? 'border-primary-container bg-primary-container/10 text-primary' : 'border-slate-300 bg-white text-slate-700'}`}>
                <input type="checkbox" checked={selected} onChange={() => set('categoryIds', selected ? value.categoryIds.filter((id) => id !== category.id) : [...value.categoryIds, category.id])} />
                {category.name}
              </label>;
            })}
          </div>
        )}
      </fieldset>
      <div className="grid gap-5 md:grid-cols-3">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">Ảnh <span className="font-normal text-slate-500">(Optional, URL)</span>
          <textarea className={inputClass} rows={3} value={(value.images ?? []).join('\n')} onChange={(e) => set('images', e.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">Bao gồm
          <textarea className={inputClass} rows={3} value={(value.inclusions ?? []).join('\n')} onChange={(e) => set('inclusions', e.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">Không bao gồm
          <textarea className={inputClass} rows={3} value={(value.exclusions ?? []).join('\n')} onChange={(e) => set('exclusions', e.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} />
        </label>
      </div>
    </div>
  );
}
