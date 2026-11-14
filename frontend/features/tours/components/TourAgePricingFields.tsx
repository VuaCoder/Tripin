"use client";
import { ageUnitPrice, MONEY_LIMITS } from '@travel-platform/constants';
import { formatCurrencyVndInput, parseCurrencyVndInput } from '@/lib/travel-format';
import type { TourContentInput } from '../types';

export function TourAgePricingFields({ value, onChange }: { value: TourContentInput; onChange: (value: TourContentInput) => void }) {
  const existingCounts = {
    ...(value.agePricing?.adultMaxCount !== undefined ? { adultMaxCount: value.agePricing.adultMaxCount } : {}),
    ...(value.agePricing?.childMaxCount !== undefined ? { childMaxCount: value.agePricing.childMaxCount } : {}),
    ...(value.agePricing?.infantMaxCount !== undefined ? { infantMaxCount: value.agePricing.infantMaxCount } : {}),
  };

  const childVal = ageUnitPrice(value.basePrice, value.agePricing, 'child');
  const infantVal = ageUnitPrice(value.basePrice, value.agePricing, 'infant');

  const isChildFree = childVal === 0;
  const isInfantFree = infantVal === 0;

  const handleToggleChildFree = () => {
    if (isChildFree) {
      // Uncheck free -> set back to empty/null
      onChange({
        ...value,
        agePricing: {
          ...existingCounts,
          childMinAge: 2,
          adultMinAge: 13,
          childPercent: 100,
          infantPercent: 100,
          childPrice: null,
          infantPrice: value.agePricing?.infantPrice !== undefined ? value.agePricing.infantPrice : ageUnitPrice(value.basePrice, value.agePricing, 'infant'),
        },
      });
    } else {
      // Check free -> set price to 0
      onChange({
        ...value,
        agePricing: {
          ...existingCounts,
          childMinAge: 2,
          adultMinAge: 13,
          childPercent: 100,
          infantPercent: 100,
          childPrice: 0,
          infantPrice: value.agePricing?.infantPrice !== undefined ? value.agePricing.infantPrice : ageUnitPrice(value.basePrice, value.agePricing, 'infant'),
        },
      });
    }
  };

  const handleToggleInfantFree = () => {
    if (isInfantFree) {
      // Uncheck free -> set back to empty/null
      onChange({
        ...value,
        agePricing: {
          ...existingCounts,
          childMinAge: 2,
          adultMinAge: 13,
          childPercent: 100,
          infantPercent: 100,
          childPrice: value.agePricing?.childPrice !== undefined ? value.agePricing.childPrice : ageUnitPrice(value.basePrice, value.agePricing, 'child'),
          infantPrice: null,
        },
      });
    } else {
      // Check free -> set price to 0
      onChange({
        ...value,
        agePricing: {
          ...existingCounts,
          childMinAge: 2,
          adultMinAge: 13,
          childPercent: 100,
          infantPercent: 100,
          childPrice: value.agePricing?.childPrice !== undefined ? value.agePricing.childPrice : ageUnitPrice(value.basePrice, value.agePricing, 'child'),
          infantPrice: 0,
        },
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Age pricing inputs - always available independently of capacity */}
      <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in duration-150">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-800">Trẻ em (2 - 12 tuổi) - VND</label>
            <button
              type="button"
              onClick={handleToggleChildFree}
              role="checkbox"
              aria-checked={isChildFree}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-bold transition-all cursor-pointer ${
                isChildFree 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span className={`flex size-3.5 items-center justify-center rounded border transition-colors ${
                isChildFree ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-400 bg-white'
              }`}>
                {isChildFree && <span className="text-[10px] font-black leading-none">✓</span>}
              </span>
              <span>Miễn phí</span>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              disabled={isChildFree}
              aria-label="Giá Trẻ em (2 - 12 tuổi)"
              placeholder={isChildFree ? 'Miễn phí vé' : 'Để trống nếu không áp dụng'}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none transition pr-10 ${
                isChildFree
                  ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800 cursor-not-allowed placeholder:text-emerald-700'
                  : 'border-slate-300 bg-white text-slate-900 focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20'
              }`}
              value={isChildFree ? '0' : (childVal !== null && childVal !== undefined ? formatCurrencyVndInput(childVal) : '')}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  onChange({
                    ...value,
                    agePricing: {
                      ...existingCounts,
                      childMinAge: 2,
                      adultMinAge: 13,
                      childPercent: 100,
                      infantPercent: 100,
                      childPrice: null,
                      infantPrice: value.agePricing?.infantPrice !== undefined ? value.agePricing.infantPrice : ageUnitPrice(value.basePrice, value.agePricing, 'infant'),
                    },
                  });
                  return;
                }
                const parsed = parseCurrencyVndInput(raw);
                if (parsed <= MONEY_LIMITS.MAX_UNIT_PRICE) {
                  onChange({
                    ...value,
                    agePricing: {
                      ...existingCounts,
                      childMinAge: 2,
                      adultMinAge: 13,
                      childPercent: 100,
                      infantPercent: 100,
                      childPrice: parsed,
                      infantPrice: value.agePricing?.infantPrice !== undefined ? value.agePricing.infantPrice : ageUnitPrice(value.basePrice, value.agePricing, 'infant'),
                    },
                  });
                }
              }}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">₫</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-800">Em bé (dưới 2 tuổi) - VND</label>
            <button
              type="button"
              onClick={handleToggleInfantFree}
              role="checkbox"
              aria-checked={isInfantFree}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-bold transition-all cursor-pointer ${
                isInfantFree 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span className={`flex size-3.5 items-center justify-center rounded border transition-colors ${
                isInfantFree ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-400 bg-white'
              }`}>
                {isInfantFree && <span className="text-[10px] font-black leading-none">✓</span>}
              </span>
              <span>Miễn phí</span>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              disabled={isInfantFree}
              aria-label="Giá Em bé (dưới 2 tuổi)"
              placeholder={isInfantFree ? 'Miễn phí vé' : 'Để trống nếu không áp dụng'}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none transition pr-10 ${
                isInfantFree
                  ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800 cursor-not-allowed placeholder:text-emerald-700'
                  : 'border-slate-300 bg-white text-slate-900 focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20'
              }`}
              value={isInfantFree ? '0' : (infantVal !== null && infantVal !== undefined ? formatCurrencyVndInput(infantVal) : '')}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  onChange({
                    ...value,
                    agePricing: {
                      ...existingCounts,
                      childMinAge: 2,
                      adultMinAge: 13,
                      childPercent: 100,
                      infantPercent: 100,
                      childPrice: value.agePricing?.childPrice !== undefined ? value.agePricing.childPrice : ageUnitPrice(value.basePrice, value.agePricing, 'child'),
                      infantPrice: null,
                    },
                  });
                  return;
                }
                const parsed = parseCurrencyVndInput(raw);
                if (parsed <= MONEY_LIMITS.MAX_UNIT_PRICE) {
                  onChange({
                    ...value,
                    agePricing: {
                      ...existingCounts,
                      childMinAge: 2,
                      adultMinAge: 13,
                      childPercent: 100,
                      infantPercent: 100,
                      childPrice: value.agePricing?.childPrice !== undefined ? value.agePricing.childPrice : ageUnitPrice(value.basePrice, value.agePricing, 'child'),
                      infantPrice: parsed,
                    },
                  });
                }
              }}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">₫</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-slate-800">
          Ghi chú chính sách trẻ em
        </label>
        <textarea
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20 placeholder:font-normal placeholder:text-slate-400"
          rows={3}
          maxLength={5000}
          placeholder="Ví dụ: Mỗi gia đình chỉ kèm 1 em bé miễn phí, em bé thứ 2 tính vé trẻ em..."
          value={value.childPricingPolicy ?? ''}
          onChange={(e) => onChange({ ...value, childPricingPolicy: e.target.value })}
        />
      </div>
    </div>
  );
}
