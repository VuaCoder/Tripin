'use client';

import React, { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { selectActiveAgency } from '@/features/auth/store/authSlice';
import { 
  Percent, 
  Send, 
  Check, 
  TrendingUp, 
  Wallet, 
  Info,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { Modal } from '@/components/ui';

const formatMoney = (val: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(val))} ₫`;

export function AgencyCommissionSettings() {
  const user = useAppSelector(selectUser);
  const agency = useAppSelector(selectActiveAgency);
  const storageKey = user?.id && agency?.agencyId ? `tripri_agency_discount_rate_${user.id}_${agency.agencyId}` : null;
  const requestHistoryKey = user?.id && agency?.agencyId ? `tripri_agency_discount_request_${user.id}_${agency.agencyId}` : null;

  // Tỷ lệ chiết khấu mà doanh nghiệp hưởng / chiết khấu sản phẩm
  const [discountRate, setDiscountRate] = useState<number>(10.0);
  const [samplePrice, setSamplePrice] = useState<number>(3500000);
  
  // Popup điều chỉnh chiết khấu
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestedRate, setRequestedRate] = useState<number>(10.0);
  const [requestReason, setRequestReason] = useState<string>('');
  const [pendingRequest, setPendingRequest] = useState<{ rate: number; date: string; reason: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 50) {
          setDiscountRate(parsed);
          setRequestedRate(parsed);
        }
      }
      if (requestHistoryKey) {
        const storedReq = localStorage.getItem(requestHistoryKey);
        if (storedReq) {
          try {
            setPendingRequest(JSON.parse(storedReq));
          } catch {
            // ignore
          }
        }
      }
    }
  }, [storageKey, requestHistoryKey]);

  const handleOpenModal = () => {
    setRequestedRate(discountRate);
    setRequestReason('');
    setIsModalOpen(true);
  };

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const reqData = {
      rate: requestedRate,
      date: new Date().toLocaleDateString('vi-VN'),
      reason: requestReason.trim(),
    };
    if (typeof window !== 'undefined' && requestHistoryKey) {
      localStorage.setItem(requestHistoryKey, JSON.stringify(reqData));
    }
    setPendingRequest(reqData);
    setIsModalOpen(false);
    setToastMessage(`Đã gửi yêu cầu áp dụng mức chiết khấu ${requestedRate}% tới hệ thống!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Tính toán: Doanh thu chiết khấu doanh nghiệp được hưởng (Agency Commission/Earning)
  const calculatedAgencyEarning = (samplePrice * discountRate) / 100;
  const calculatedNetPaid = samplePrice - calculatedAgencyEarning;

  return (
    <div className="space-y-6">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-bold text-emerald-800 flex items-center gap-2 shadow-xs">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Commission Status Card (View-only + Nút Điều chỉnh) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/60 inline-block mb-2">
              Mức chiết khấu doanh nghiệp hưởng
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900">
                {discountRate.toFixed(1)}
              </span>
              <span className="text-3xl font-extrabold text-teal-600">%</span>
            </div>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              Đây là tỷ lệ hoa hồng chiết khấu doanh nghiệp của bạn được nhận trên mỗi đơn tour thành công. 
              Mức chiết khấu này áp dụng trực tiếp vào tài khoản thu nhập đối tác.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white px-5 py-3 text-sm font-bold shadow-sm shadow-teal-700/20 transition cursor-pointer"
            >
              <SlidersHorizontal size={17} />
              <span>Gửi yêu cầu điều chỉnh</span>
            </button>
            {pendingRequest && (
              <span className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/80 font-medium">
                Yêu cầu {pendingRequest.rate}% gửi ngày {pendingRequest.date} (đang xử lý)
              </span>
            )}
          </div>
        </div>

        {/* Thông tin mô phỏng chiết khấu */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-teal-700" />
              <h3 className="text-sm font-bold text-slate-900">Mô phỏng mức chiết khấu thu về</h3>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 font-medium mr-1">Giá tour:</span>
              {[2000000, 5000000, 10000000, 20000000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSamplePrice(preset)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    samplePrice === preset
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {(preset / 1000000).toFixed(0)} triệu
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 pt-2">
            {/* 1. Giá tour niêm yết */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Giá tour niêm yết</span>
              <p className="mt-2 text-2xl font-black text-slate-900">{formatMoney(samplePrice)}</p>
              <p className="mt-1 text-xs text-slate-400">Giá bán gốc của tour</p>
            </div>

            {/* 2. Tiền chiết khấu doanh nghiệp nhận */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold uppercase tracking-wider">Tiền chiết khấu nhận ({discountRate}%)</span>
                <Percent size={15} />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-800">{formatMoney(calculatedAgencyEarning)}</p>
              <p className="mt-1 text-xs text-emerald-700/80">Khoản thu nhập chiết khấu của bạn</p>
            </div>

            {/* 3. Doanh thu sau chiết khấu */}
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
              <div className="flex items-center justify-between text-teal-800">
                <span className="text-xs font-bold uppercase tracking-wider">Doanh thu tour thu về</span>
                <TrendingUp size={15} />
              </div>
              <p className="mt-2 text-2xl font-black text-teal-900">{formatMoney(calculatedNetPaid)}</p>
              <p className="mt-1 text-xs text-teal-700/80">Sau khi trừ khoản chiết khấu</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Popup Điều chỉnh chiết khấu */}
      <Modal
        open={isModalOpen}
        title="Yêu cầu điều chỉnh mức chiết khấu"
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSendRequest} className="space-y-5 pt-2">
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-xs text-slate-600 flex items-start gap-2.5">
            <Info size={18} className="text-teal-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">Cơ chế phê duyệt chính sách chiết khấu:</p>
              <p className="mt-1 text-slate-600">
                Mức chiết khấu doanh nghiệp được xét duyệt định kỳ theo quy mô và cam kết doanh số.
                Yêu cầu của bạn sẽ được chuyển đến ban quản trị xét duyệt trong vòng 24 giờ.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="desired-discount" className="block text-xs font-bold text-slate-700 mb-1.5">
              Mức chiết khấu mong muốn (%):
            </label>
            <div className="flex items-center gap-3">
              <input
                id="desired-discount"
                type="number"
                min="1"
                max="50"
                step="0.5"
                required
                value={requestedRate}
                onChange={(e) => setRequestedRate(Math.min(50, Math.max(1, parseFloat(e.target.value) || 0)))}
                className="w-32 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              />
              <span className="text-sm font-semibold text-slate-500">Giới hạn từ 1% đến 50%</span>
            </div>
          </div>

          <div>
            <label htmlFor="request-reason" className="block text-xs font-bold text-slate-700 mb-1.5">
              Lý do hoặc đề xuất cam kết (không bắt buộc):
            </label>
            <textarea
              id="request-reason"
              rows={3}
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="Ví dụ: Tăng lượng booking dự kiến vào mùa cao điểm, mở thêm nhiều tuyến tour mới..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-teal-700 shadow-sm transition"
            >
              <Send size={15} />
              <span>Gửi yêu cầu</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
