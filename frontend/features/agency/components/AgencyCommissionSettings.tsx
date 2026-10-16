'use client';

import React, { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { CounterUp } from '@/components/ui/CounterUp';
import { 
  Percent, 
  Calculator, 
  Sparkles, 
  Bookmark, 
  Check, 
  Minus, 
  Plus, 
  TrendingUp, 
  Wallet, 
  BadgeCheck 
} from 'lucide-react';

const formatMoney = (val: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(val))} ₫`;

export function AgencyCommissionSettings() {
  const user = useAppSelector(selectUser);
  const storageKey = user?.id ? `tripri_agency_discount_rate_${user.id}` : 'tripri_agency_discount_rate';

  const [commissionRate, setCommissionRate] = useState<number>(10.0);
  const [samplePrice, setSamplePrice] = useState<number>(3500000);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 50) {
          setCommissionRate(parsed);
        }
      }
    }
  }, [storageKey]);

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, commissionRate.toString());
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Calculations
  const calculatedCommission = (samplePrice * commissionRate) / 100;
  const calculatedNetRevenue = samplePrice - calculatedCommission;
  const retentionRate = 100 - commissionRate;

  return (
    <div className="space-y-6">
      {/* Top Hero Banner - Rich Modern Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-6 sm:p-8 text-white shadow-lg">
        {/* Decorative soft glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 size-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-bold text-teal-300 border border-teal-500/30 backdrop-blur-sm">
              <Sparkles size={14} className="text-teal-400" />
              Mức chiết khấu sản phẩm
            </span>
            <span className="text-xs font-medium text-slate-400">Hiệu ứng Counter-up tức thì</span>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">Tỷ lệ chiết khấu đang chọn</p>
              <div className="mt-1 flex items-baseline gap-2">
                <CounterUp
                  value={commissionRate}
                  decimals={1}
                  duration={600}
                  className="text-5xl sm:text-6xl font-black tracking-tight text-white"
                />
                <span className="text-3xl font-extrabold text-teal-400">%</span>
              </div>
            </div>

            {/* Save Preference Button */}
            <button
              type="button"
              onClick={handleSave}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold transition shadow-md cursor-pointer ${
                saved
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-teal-500/20'
              }`}
            >
              {saved ? <Check size={18} /> : <Bookmark size={18} />}
              <span>{saved ? 'Đã lưu cấu hình!' : 'Lưu mức chiết khấu này'}</span>
            </button>
          </div>

          {/* Slider & Presets Controls */}
          <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCommissionRate((prev) => Math.max(0, Math.round((prev - 0.5) * 10) / 10))}
                className="flex size-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer"
                title="Giảm 0.5%"
              >
                <Minus size={18} />
              </button>

              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="0.5"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer h-2.5 bg-white/20 rounded-lg"
                />
              </div>

              <button
                type="button"
                onClick={() => setCommissionRate((prev) => Math.min(40, Math.round((prev + 0.5) * 10) / 10))}
                className="flex size-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer"
                title="Tăng 0.5%"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold mr-1">Gợi ý nhanh:</span>
              {[5, 8, 10, 12, 15, 20].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setCommissionRate(rate)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    commissionRate === rate
                      ? 'bg-teal-400 text-slate-950 shadow-sm'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Simulator Section - Modern 3-Column Visual Metric Cards */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Mô phỏng doanh số sản phẩm</h3>
              <p className="text-xs text-slate-400">Xem ngay số tiền chiết khấu & doanh thu thực nhận</p>
            </div>
          </div>

          {/* Sample Price Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Giá tour mẫu:</span>
            <div className="flex gap-1.5">
              {[1500000, 3500000, 6000000, 10000000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSamplePrice(preset)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    samplePrice === preset
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {(preset / 1000000).toFixed(1)} tr
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Price Input */}
        <div className="max-w-md">
          <label className="text-xs font-bold text-slate-600 block mb-1">
            Nhập giá niêm yết tuỳ chọn (VND):
          </label>
          <div className="relative">
            <input
              type="number"
              min="100000"
              step="100000"
              value={samplePrice}
              onChange={(e) => setSamplePrice(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 py-2.5 pl-4 pr-10 text-sm font-black text-slate-900 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="absolute right-4 top-3 text-xs font-bold text-slate-400 pointer-events-none">₫</span>
          </div>
        </div>

        {/* 3 Metric Cards with CounterUp Animation */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* 1. Giá gốc */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Giá niêm yết (Gross)</span>
              <Wallet size={16} className="text-slate-400" />
            </div>
            <div className="mt-2.5">
              <CounterUp
                value={samplePrice}
                duration={600}
                formatter={formatMoney}
                className="text-xl sm:text-2xl font-black text-slate-900"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">100% giá trị tour</p>
          </div>

          {/* 2. Tiền chiết khấu */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-xs font-bold uppercase tracking-wider">Chiết khấu ({commissionRate}%)</span>
              <Percent size={16} />
            </div>
            <div className="mt-2.5">
              <CounterUp
                value={calculatedCommission}
                duration={600}
                formatter={formatMoney}
                className="text-xl sm:text-2xl font-black text-amber-800"
              />
            </div>
            <p className="mt-1 text-xs text-amber-700/80">Số tiền chiết khấu / đơn</p>
          </div>

          {/* 3. Doanh thu Agency thực nhận */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 sm:p-5">
            <div className="flex items-center justify-between text-teal-700">
              <span className="text-xs font-bold uppercase tracking-wider">Agency thực nhận (Net)</span>
              <TrendingUp size={16} />
            </div>
            <div className="mt-2.5">
              <CounterUp
                value={calculatedNetRevenue}
                duration={600}
                formatter={formatMoney}
                className="text-xl sm:text-2xl font-black text-teal-800"
              />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-teal-700">
              <BadgeCheck size={14} />
              <span>
                Giữ lại <CounterUp value={retentionRate} decimals={1} duration={500} suffix="%" /> doanh thu
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
