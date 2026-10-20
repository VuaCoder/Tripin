'use client';

import { useId } from 'react';
import type { TourContentInput } from '../types';
import { formatVnd } from '../utils';

interface Props {
  value: TourContentInput;
  onChange: (value: TourContentInput) => void;
}

const CHILD_POLICY_PRESETS = [
  '👶 Dưới 2 tuổi: Miễn phí (ngồi chung với bố mẹ, gia đình tự lo ăn uống)',
  '🧒 Trẻ 2 - 11 tuổi: Tính 50% vé người lớn (có ghế riêng, suất ăn riêng)',
  '🧑 Từ 12 tuổi trở lên: Tính 100% như vé người lớn',
  '👨‍👩‍👦 2 người lớn chỉ được kèm tối đa 1 trẻ em miễn phí, từ trẻ thứ 2 tính vé trẻ em',
  '🛏️ Phụ thu giường phụ (Extra bed) tại khách sạn nếu gia đình có yêu cầu',
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

  // Live calculations for preview
  const adultPrice = value.basePrice || 0;
  const childPrice = pricing ? Math.round((adultPrice * pricing.childPercent) / 100) : adultPrice;
  const infantPrice = pricing ? Math.round((adultPrice * pricing.infantPercent) / 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-4">
      {/* Header with Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div>
          <label htmlFor={checkboxId} className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              id={checkboxId}
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => toggleAgePricing(e.target.checked)}
              className="size-4.5 rounded border-slate-300 text-[#087e8b] focus:ring-[#087e8b]"
            />
            <span className="text-sm font-bold text-slate-800">
              Áp dụng chính sách giá theo độ tuổi (Trẻ em & Em bé) <span className="text-xs font-normal text-slate-500">(optional)</span>
            </span>
          </label>
          <p className="text-xs text-slate-500 mt-0.5 ml-7">
            Thiết lập khoảng tuổi và tỷ lệ phần trăm vé người lớn cho từng độ tuổi.
          </p>
        </div>

        {isEnabled && (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 border border-teal-200/60">
            ✓ Đang kích hoạt
          </span>
        )}
      </div>

      {isEnabled && pricing && (
        <div className="space-y-4 pt-1 animate-in fade-in duration-150">
          {/* 4 Input fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Tuổi nhóm trẻ em
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={17}
                  value={pricing.childMinAge}
                  onChange={(e) => updatePricingField('childMinAge', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-12 text-sm font-bold text-slate-800 outline-none focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">
                  tuổi
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Tuổi nhóm người lớn
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={2}
                  max={18}
                  value={pricing.adultMinAge}
                  onChange={(e) => updatePricingField('adultMinAge', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-12 text-sm font-bold text-slate-800 outline-none focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">
                  tuổi
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Giá trẻ em (% người lớn)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pricing.childPercent}
                  onChange={(e) => updatePricingField('childPercent', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm font-bold text-[#087e8b] outline-none focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Giá em bé (% người lớn)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pricing.infantPercent}
                  onChange={(e) => updatePricingField('infantPercent', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm font-bold text-[#087e8b] outline-none focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 select-none">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Visual calculation card */}
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3.5">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-800 block mb-2">
              Bảng quy đổi giá tự động theo giá cơ bản:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-lg bg-white p-2.5 border border-teal-100 shadow-2xs">
                <span className="text-slate-500 font-medium block">🧑 Người lớn (≥ {pricing.adultMinAge} tuổi)</span>
                <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                  {formatVnd(adultPrice)}
                </span>
                <span className="text-[11px] text-teal-700 font-semibold">(100% giá gốc)</span>
              </div>

              <div className="rounded-lg bg-white p-2.5 border border-teal-100 shadow-2xs">
                <span className="text-slate-500 font-medium block">🧒 Trẻ em ({pricing.childMinAge} - {pricing.adultMinAge - 1} tuổi)</span>
                <span className="text-sm font-extrabold text-[#087e8b] block mt-0.5">
                  {formatVnd(childPrice)}
                </span>
                <span className="text-[11px] text-teal-700 font-semibold">({pricing.childPercent}% giá người lớn)</span>
              </div>

              <div className="rounded-lg bg-white p-2.5 border border-teal-100 shadow-2xs">
                <span className="text-slate-500 font-medium block">👶 Em bé (&lt; {pricing.childMinAge} tuổi)</span>
                <span className="text-sm font-extrabold text-emerald-700 block mt-0.5">
                  {pricing.infantPercent === 0 ? 'Miễn phí' : formatVnd(infantPrice)}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold">({pricing.infantPercent}% giá người lớn)</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Lưu ý: Tuổi được tính căn cứ theo ngày khởi hành. Hệ thống tự động làm tròn giá vé đến đơn vị đồng khi du khách đặt tour.
            </p>
          </div>

          {/* Child Pricing Policy Terms / Notes */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Ghi chú chính sách trẻ em chi tiết <span className="text-xs font-normal text-slate-500">(optional)</span>:
              </label>
              <span className="text-[11px] text-slate-400">
                {(value.childPricingPolicy || '').length}/5000 ký tự
              </span>
            </div>

            {/* Quick 1-click Preset Chips */}
            <div className="flex flex-wrap gap-1.5">
              {CHILD_POLICY_PRESETS.map((preset) => {
                const isSelected = (value.childPricingPolicy || '').includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => toggleChildPolicyPreset(preset)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-[#087e8b] hover:text-[#087e8b]'
                    }`}
                  >
                    {isSelected ? `✓ ${preset}` : `+ ${preset}`}
                  </button>
                );
              })}
            </div>

            <textarea
              rows={3}
              maxLength={5000}
              value={value.childPricingPolicy || ''}
              onChange={(e) => onChange({ ...value, childPricingPolicy: e.target.value })}
              placeholder="Nhập thêm quy định chi tiết cho gia đình có trẻ em (ví dụ: quy định ghế ngồi trên xe, phụ thu ăn sáng tại khách sạn...)"
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm text-slate-800 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}
