'use client';

import { useId } from 'react';
import type { TourContentInput } from '../types';

interface Props {
  value: TourContentInput;
  onChange: (value: TourContentInput) => void;
}

const CHILD_POLICY_PRESETS = [
  'Dưới 2 tuổi: Miễn phí (ngồi chung bố mẹ)',
  'Trẻ 2 - 11 tuổi: Tính 50% vé người lớn (ghế riêng, suất ăn riêng)',
  'Từ 12 tuổi trở lên: Tính 100% như vé người lớn',
  'Tối đa 1 trẻ em miễn phí / 2 người lớn',
  'Phụ thu giường phụ (Extra bed) tại khách sạn nếu có yêu cầu',
];

export function TourAgePricingFields({ value, onChange }: Props) {
  const checkboxId = useId();
  const pricing = value.agePricing;
  const isEnabled = Boolean(pricing);

  const toggleAgePricing = (checked: boolean) => {
    if (checked) {
      onChange({
        ...value,
        agePricing: {
          childMinAge: 2,
          adultMinAge: 12,
          childPercent: 50,
          infantPercent: 0,
        },
      });
    } else {
      onChange({
        ...value,
        agePricing: null,
      });
    }
  };

  const updatePricingField = (
    key: 'childMinAge' | 'adultMinAge' | 'childPercent' | 'infantPercent',
    numVal: number,
  ) => {
    if (!pricing) return;
    onChange({
      ...value,
      agePricing: {
        ...pricing,
        [key]: numVal,
      },
    });
  };

  const toggleChildPolicyPreset = (presetText: string) => {
    const current = value.childPricingPolicy || '';
    if (current.includes(presetText)) {
      // Remove
      const cleaned = current
        .split('\n')
        .filter((line) => line.trim() !== presetText.trim())
        .join('\n')
        .trim();
      onChange({ ...value, childPricingPolicy: cleaned });
    } else {
      // Append
      const next = current.trim() ? `${current.trim()}\n${presetText}` : presetText;
      onChange({ ...value, childPricingPolicy: next });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5 space-y-4">
      {/* Header with Switch */}
      <div className="flex items-center justify-between">
        <label htmlFor={checkboxId} className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            id={checkboxId}
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => toggleAgePricing(e.target.checked)}
            className="size-4 rounded border-slate-300 text-[#087e8b] focus:ring-[#087e8b]"
          />
          <span className="text-sm font-bold text-slate-800">
            Áp dụng chính sách giá theo độ tuổi (Trẻ em & Em bé) <span className="text-xs font-normal text-slate-500">(Optional)</span>
          </span>
        </label>
      </div>

      {isEnabled && pricing && (
        <div className="space-y-4 pt-1 animate-in fade-in duration-150 border-t border-slate-200/60 pt-3">
          {/* 4 Inputs in a clean single row / responsive 4-column grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Tuổi nhóm trẻ em
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={17}
                  value={pricing.childMinAge}
                  onChange={(e) => updatePricingField('childMinAge', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-12 text-sm font-bold text-slate-800 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/15"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">
                  tuổi
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Tuổi nhóm người lớn
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={2}
                  max={18}
                  value={pricing.adultMinAge}
                  onChange={(e) => updatePricingField('adultMinAge', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-12 text-sm font-bold text-slate-800 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/15"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">
                  tuổi
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Giá trẻ em (% người lớn)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pricing.childPercent}
                  onChange={(e) => updatePricingField('childPercent', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm font-bold text-[#087e8b] outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/15"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Giá em bé (% người lớn)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pricing.infantPercent}
                  onChange={(e) => updatePricingField('infantPercent', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm font-bold text-[#087e8b] outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/15"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Child Pricing Policy Terms / Notes */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Ghi chú chính sách trẻ em chi tiết:
              </label>
              <span className="text-[11px] text-slate-400">
                {(value.childPricingPolicy || '').length}/5000 ký tự
              </span>
            </div>

            {/* Clean preset chips */}
            <div className="flex flex-wrap gap-1.5">
              {CHILD_POLICY_PRESETS.map((preset) => {
                const isSelected = (value.childPricingPolicy || '').includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => toggleChildPolicyPreset(preset)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition cursor-pointer border ${
                      isSelected
                        ? 'border-teal-300 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700'
                    }`}
                  >
                    {isSelected ? `✓ ${preset}` : `+ ${preset}`}
                  </button>
                );
              })}
            </div>

            <textarea
              rows={2}
              maxLength={5000}
              value={value.childPricingPolicy || ''}
              onChange={(e) => onChange({ ...value, childPricingPolicy: e.target.value })}
              placeholder="Quy định thêm cho trẻ em (ghế ngồi, phụ thu giường phụ, suất ăn...)"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-800 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/15"
            />
          </div>
        </div>
      )}
    </div>
  );
}
