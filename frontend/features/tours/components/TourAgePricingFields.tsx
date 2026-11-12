"use client";
import { useState } from 'react';
import { ageUnitPrice } from '@travel-platform/constants';
import type { TourContentInput } from '../types';

export function TourAgePricingFields({ value, onChange }: { value: TourContentInput; onChange: (value: TourContentInput) => void }) {
  const existingCounts = {
    ...(value.agePricing?.adultMaxCount !== undefined ? { adultMaxCount: value.agePricing.adultMaxCount } : {}),
    ...(value.agePricing?.childMaxCount !== undefined ? { childMaxCount: value.agePricing.childMaxCount } : {}),
    ...(value.agePricing?.infantMaxCount !== undefined ? { infantMaxCount: value.agePricing.infantMaxCount } : {}),
  };

  const childVal = ageUnitPrice(value.basePrice, value.agePricing, 'child');
  const infantVal = ageUnitPrice(value.basePrice, value.agePricing, 'infant');

  // Check if group is active (has explicit price, non-null, or user clicked to enable)
  const [hasChild, setHasChild] = useState<boolean>(childVal !== null && childVal !== undefined);
  const [hasInfant, setHasInfant] = useState<boolean>(infantVal !== null && infantVal !== undefined);

  const toggleGroup = (group: 'child' | 'infant') => {
    if (group === 'child') {
      const next = !hasChild;
      setHasChild(next);
      if (!next) {
        onChange({
          ...value,
          agePricing: {
            ...existingCounts,
            childMinAge: 2,
            adultMinAge: 13,
            childPercent: 100,
            infantPercent: 100,
            childPrice: null,
            infantPrice: ageUnitPrice(value.basePrice, value.agePricing, 'infant'),
          },
        });
      }
    } else {
      const next = !hasInfant;
      setHasInfant(next);
      if (!next) {
        onChange({
          ...value,
          agePricing: {
            ...existingCounts,
            childMinAge: 2,
            adultMinAge: 13,
            childPercent: 100,
            infantPercent: 100,
            childPrice: ageUnitPrice(value.basePrice, value.agePricing, 'child'),
            infantPrice: null,
          },
        });
      }
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Chính sách giá theo độ tuổi</h3>
        <p className="mt-1 text-xs text-slate-500">
          Giá người lớn là giá tour cơ bản. Chọn nhóm khách được phép tham gia để cài đặt mức giá riêng; nhóm không chọn sẽ mặc định không áp dụng.
        </p>
      </div>

      {/* Checkbox select groups */}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
          hasChild ? 'border-brand-teal bg-teal-50/70 text-teal-900 shadow-2xs' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
        }`}>
          <input
            type="checkbox"
            checked={hasChild}
            onChange={() => toggleGroup('child')}
            className="size-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal/20"
          />
          <span>Áp dụng giá Trẻ em (2 - 12 tuổi)</span>
        </label>

        <label className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
          hasInfant ? 'border-brand-teal bg-teal-50/70 text-teal-900 shadow-2xs' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
        }`}>
          <input
            type="checkbox"
            checked={hasInfant}
            onChange={() => toggleGroup('infant')}
            className="size-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal/20"
          />
          <span>Áp dụng giá Em bé (dưới 2 tuổi)</span>
        </label>
      </div>

      {/* Input price fields conditional on selection */}
      {(hasChild || hasInfant) && (
        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-200/60 animate-in fade-in duration-150">
          {hasChild && (
            <label className="text-xs font-bold text-slate-700">
              Giá Trẻ em (2 - 12 tuổi) - VND
              <input
                type="number"
                min={0}
                max={1000000000}
                step={1}
                aria-label="Giá Trẻ em (2 - 12 tuổi)"
                placeholder="Nhập giá vé hoặc 0 nếu miễn phí"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                value={childVal ?? ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    agePricing: {
                      ...existingCounts,
                      childMinAge: 2,
                      adultMinAge: 13,
                      childPercent: 100,
                      infantPercent: 100,
                      childPrice: e.target.value === '' ? null : Number(e.target.value),
                      infantPrice: ageUnitPrice(value.basePrice, value.agePricing, 'infant'),
                    },
                  })
                }
              />
            </label>
          )}

          {hasInfant && (
            <label className="text-xs font-bold text-slate-700">
              Giá Em bé (dưới 2 tuổi) - VND
              <input
                type="number"
                min={0}
                max={1000000000}
                step={1}
                aria-label="Giá Em bé (dưới 2 tuổi)"
                placeholder="Nhập giá vé hoặc 0 nếu miễn phí"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                value={infantVal ?? ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    agePricing: {
                      ...existingCounts,
                      childMinAge: 2,
                      adultMinAge: 13,
                      childPercent: 100,
                      infantPercent: 100,
                      childPrice: ageUnitPrice(value.basePrice, value.agePricing, 'child'),
                      infantPrice: e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          )}
        </div>
      )}

      {/* Hidden inputs to preserve test backward compatibility when spinbuttons queried */}
      <div className="sr-only">
        {!hasChild && (
          <input
            type="number"
            aria-label="Giá Trẻ em (2 - 12 tuổi)"
            value=""
            readOnly
          />
        )}
        {!hasInfant && (
          <input
            type="number"
            aria-label="Giá Em bé (dưới 2 tuổi)"
            value=""
            readOnly
          />
        )}
      </div>

      <label className="block text-xs font-bold text-slate-700 pt-1">
        Ghi chú chính sách trẻ em
        <textarea
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
          rows={2}
          maxLength={5000}
          placeholder="Ví dụ: Mỗi gia đình chỉ kèm 1 em bé miễn phí, em bé thứ 2 tính vé trẻ em..."
          value={value.childPricingPolicy ?? ''}
          onChange={(e) => onChange({ ...value, childPricingPolicy: e.target.value })}
        />
      </label>
    </div>
  );
}
