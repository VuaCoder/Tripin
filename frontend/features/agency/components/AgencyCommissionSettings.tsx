'use client';

import React, { useState } from 'react';
import { BadgePercent, Check, Clock3, Info, Percent, Send, SlidersHorizontal, TrendingUp, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui';
import { useAgencyPermission } from '../AgencyCommon';
import {
  useCancelAgencyCommissionRequestMutation,
  useCreateAgencyCommissionRequestMutation,
  useGetAgencyCommissionQuery,
  type CommissionRequestStatus,
} from '../commissionApi';

const formatMoney = (val: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(val))} ₫`;
const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value));
const STATUS_LABEL: Record<CommissionRequestStatus, { label: string; className: string }> = {
  PENDING: { label: 'Đang chờ duyệt', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Bị từ chối', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Đã huỷ', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function AgencyCommissionSettings() {
  const { data, isLoading, isError, refetch } = useGetAgencyCommissionQuery();
  const [createRequest, createState] = useCreateAgencyCommissionRequestMutation();
  const [cancelRequest, cancelState] = useCancelAgencyCommissionRequestMutation();
  const canRequest = useAgencyPermission('agency:finance-manage');

  const [samplePrice, setSamplePrice] = useState<number>(3_500_000);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestedRate, setRequestedRate] = useState('10');
  const [requestReason, setRequestReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const notify = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="size-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-bold text-red-700">Không thể tải mức chiết khấu</p>
        <button type="button" onClick={() => void refetch()} className="mt-3 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Thử lại</button>
      </div>
    );
  }

  const sharePercent = data.effectiveSharePercent;
  const pending = data.pendingRequest;
  const agencyEarning = (samplePrice * sharePercent) / 100;
  const platformPart = samplePrice - agencyEarning;

  const openRequest = () => {
    setRequestedRate(String(sharePercent));
    setRequestReason('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const sendRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(requestedRate);
    if (!Number.isFinite(value) || value < 0 || value > 50) {
      setFormError('Mức chiết khấu phải từ 0% đến 50%.');
      return;
    }
    if (!requestReason.trim()) {
      setFormError('Vui lòng nhập lý do điều chỉnh.');
      return;
    }
    setFormError(null);
    try {
      await createRequest({ requestedSharePercent: value, reason: requestReason.trim() }).unwrap();
      setIsModalOpen(false);
      notify(`Đã gửi yêu cầu mức ${value}% tới ban quản trị.`);
    } catch (error: any) {
      setFormError(error?.data?.error?.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.');
    }
  };

  const cancelPending = async () => {
    if (!pending) return;
    try {
      await cancelRequest(pending.id).unwrap();
      setCancelOpen(false);
      notify('Đã huỷ yêu cầu điều chỉnh.');
    } catch (error: any) {
      setCancelOpen(false);
      notify(error?.data?.error?.message || 'Không thể huỷ yêu cầu.');
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-bold text-emerald-800 flex items-center gap-2 shadow-xs">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/60 inline-block mb-2">
              Mức chiết khấu doanh nghiệp hưởng
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900">{sharePercent.toFixed(1)}</span>
              <span className="text-3xl font-extrabold text-teal-600">%</span>
            </div>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              Đây là tỷ lệ doanh nghiệp của bạn được hưởng trên mỗi đơn tour thành công; phần còn lại là phí nền tảng.
              Mức mới chỉ áp dụng cho booking tạo sau khi yêu cầu được duyệt.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Mức chung: {data.defaultSharePercent}% · {data.overrideSharePercent === null ? 'Đang dùng mức chung' : `Mức riêng: ${data.overrideSharePercent}%`}
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
            {canRequest ? (
              <button type="button" onClick={openRequest} disabled={Boolean(pending)}
                className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white px-5 py-3 text-sm font-bold shadow-sm shadow-teal-700/20 transition cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300">
                <SlidersHorizontal size={17} />
                <span>Gửi yêu cầu điều chỉnh</span>
              </button>
            ) : (
              <p className="max-w-56 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 border border-slate-200">Chỉ chủ doanh nghiệp được gửi yêu cầu điều chỉnh.</p>
            )}
            {pending && (
              <div className="flex flex-col items-start sm:items-end gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/80 font-medium">
                  <Clock3 size={13} /> Yêu cầu {pending.requestedSharePercent}% gửi ngày {formatDate(pending.createdAt)} (đang chờ duyệt)
                </span>
                {canRequest && (
                  <button type="button" onClick={() => setCancelOpen(true)} disabled={cancelState.isLoading}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline underline-offset-2 disabled:opacity-50">
                    Huỷ yêu cầu
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-teal-700" />
              <h3 className="text-sm font-bold text-slate-900">Mô phỏng mức chiết khấu thu về</h3>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 font-medium mr-1">Giá tour:</span>
              {[2_000_000, 5_000_000, 10_000_000, 20_000_000].map((preset) => (
                <button key={preset} type="button" onClick={() => setSamplePrice(preset)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition cursor-pointer ${samplePrice === preset ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {preset / 1_000_000} triệu
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 pt-2">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Giá tour niêm yết</span>
              <p className="mt-2 text-2xl font-black text-slate-900">{formatMoney(samplePrice)}</p>
              <p className="mt-1 text-xs text-slate-400">Giá bán gốc của tour</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold uppercase tracking-wider">Doanh nghiệp nhận ({sharePercent}%)</span>
                <Percent size={15} />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-800">{formatMoney(agencyEarning)}</p>
              <p className="mt-1 text-xs text-emerald-700/80">Khoản doanh nghiệp được hưởng</p>
            </div>
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
              <div className="flex items-center justify-between text-teal-800">
                <span className="text-xs font-bold uppercase tracking-wider">Phần nền tảng</span>
                <TrendingUp size={15} />
              </div>
              <p className="mt-2 text-2xl font-black text-teal-900">{formatMoney(platformPart)}</p>
              <p className="mt-1 text-xs text-teal-700/80">Phần còn lại của đơn hàng</p>
            </div>
          </div>
        </div>
      </div>

      {data.recentRequests.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><BadgePercent size={17} className="text-teal-700" /> Lịch sử yêu cầu</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-6 py-3">Ngày gửi</th><th className="px-4 py-3">Mức đề nghị</th><th className="px-4 py-3">Trạng thái</th><th className="px-6 py-3">Ghi chú</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentRequests.map((request) => {
                  const status = STATUS_LABEL[request.status];
                  return (
                    <tr key={request.id}>
                      <td className="px-6 py-4 text-slate-600">{formatDate(request.createdAt)}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">{request.requestedSharePercent}%</td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span></td>
                      <td className="px-6 py-4 text-slate-500">{request.decisionNote || request.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={isModalOpen} title="Yêu cầu điều chỉnh mức chiết khấu" onClose={() => { if (!createState.isLoading) setIsModalOpen(false); }}>
        <form onSubmit={sendRequest} className="space-y-5 pt-2">
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-xs text-slate-600 flex items-start gap-2.5">
            <Info size={18} className="text-teal-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">Yêu cầu sẽ được ban quản trị duyệt.</p>
              <p className="mt-1 text-slate-600">Mức hiện tại: {sharePercent}%. Mức mới chỉ áp dụng cho booking tạo sau khi được duyệt; booking cũ giữ nguyên.</p>
            </div>
          </div>

          <div>
            <label htmlFor="desired-discount" className="block text-xs font-bold text-slate-700 mb-1.5">Mức chiết khấu mong muốn (%):</label>
            <div className="flex items-center gap-3">
              <input id="desired-discount" type="number" min="0" max="50" step="0.5" required value={requestedRate}
                onChange={(event) => setRequestedRate(event.target.value)}
                className="w-32 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-black text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20" />
              <span className="text-sm font-semibold text-slate-500">Giới hạn từ 0% đến 50%</span>
            </div>
          </div>

          <div>
            <label htmlFor="request-reason" className="block text-xs font-bold text-slate-700 mb-1.5">Lý do điều chỉnh:</label>
            <textarea id="request-reason" rows={3} required maxLength={1000} value={requestReason}
              onChange={(event) => setRequestReason(event.target.value)}
              placeholder="Ví dụ: Tăng lượng booking dự kiến vào mùa cao điểm, mở thêm nhiều tuyến tour mới..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20" />
          </div>

          {formError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">{formError}</p>}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setIsModalOpen(false)} disabled={createState.isLoading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50">Hủy</button>
            <button type="submit" disabled={createState.isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-teal-700 shadow-sm transition disabled:opacity-50">
              <Send size={15} /><span>{createState.isLoading ? 'Đang gửi…' : 'Gửi yêu cầu'}</span>
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={cancelOpen} title="Huỷ yêu cầu điều chỉnh" onClose={() => { if (!cancelState.isLoading) setCancelOpen(false); }}>
        <p className="text-sm text-slate-600">Huỷ yêu cầu mức <strong>{pending?.requestedSharePercent}%</strong> đang chờ duyệt? Bạn có thể gửi yêu cầu mới sau đó.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setCancelOpen(false)} disabled={cancelState.isLoading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Giữ lại</button>
          <button type="button" onClick={() => void cancelPending()} disabled={cancelState.isLoading}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">{cancelState.isLoading ? 'Đang huỷ…' : 'Huỷ yêu cầu'}</button>
        </div>
      </Modal>
    </div>
  );
}
