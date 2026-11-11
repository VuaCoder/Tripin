"use client";
import { ageUnitPrice } from '@travel-platform/constants';
import type { TourContentInput } from '../types';
export function TourAgePricingFields({ value, onChange }: { value: TourContentInput; onChange: (value: TourContentInput) => void }) {
  const existingCounts = {
    ...(value.agePricing?.adultMaxCount !== undefined ? { adultMaxCount: value.agePricing.adultMaxCount } : {}),
    ...(value.agePricing?.childMaxCount !== undefined ? { childMaxCount: value.agePricing.childMaxCount } : {}),
    ...(value.agePricing?.infantMaxCount !== undefined ? { infantMaxCount: value.agePricing.infantMaxCount } : {}),
  };
  return <div className="space-y-3"><p className="text-sm text-slate-600">Giá người lớn (từ 13 tuổi trở lên) là giá tour cơ bản. Để trống giá trẻ em hoặc em bé để ẩn nhóm đó với khách du lịch; nhập 0 nếu miễn phí.</p>
    <div className="grid gap-3 sm:grid-cols-2">{(['child', 'infant'] as const).map(group => {
      const label = group === 'child' ? 'Trẻ em (2 - 12 tuổi)' : 'Em bé (dưới 2 tuổi)';
      return <label key={group} className="text-sm font-semibold">{label} - VND<input type="number" min={0} max={1000000000} step={1} aria-label={`Giá ${label}`} placeholder="Không áp dụng" className="mt-1 w-full rounded-xl border p-3" value={ageUnitPrice(value.basePrice, value.agePricing, group) ?? ''} onChange={e => onChange({ ...value, agePricing: { ...existingCounts, childMinAge: 2, adultMinAge: 13, childPercent: 100, infantPercent: 100, childPrice: ageUnitPrice(value.basePrice, value.agePricing, 'child'), infantPrice: ageUnitPrice(value.basePrice, value.agePricing, 'infant'), [group === 'child' ? 'childPrice' : 'infantPrice']: e.target.value === '' ? null : Number(e.target.value) } })} /></label>;
    })}</div><label className="block text-sm font-semibold">Ghi chú chính sách trẻ em<textarea className="mt-1 w-full rounded-xl border p-3" maxLength={5000} value={value.childPricingPolicy ?? ''} onChange={e => onChange({ ...value, childPricingPolicy: e.target.value })} /></label></div>;
}
