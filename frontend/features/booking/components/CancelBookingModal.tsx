import React, { useState } from 'react';
import { Modal } from '@/components/ui';
import type { BookingDto } from '../types';

export interface CancelBookingModalProps {
  open: boolean;
  booking: BookingDto | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (bookingId: string, reason?: string) => Promise<void>;
}

export function CancelBookingModal({
  open,
  booking,
  isLoading,
  onClose,
  onConfirm,
}: CancelBookingModalProps) {
  const [reason, setReason] = useState('');

  if (!booking) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(booking.id, reason.trim() || undefined);
    setReason('');
  };

  const isConfirmed = booking.status === 'CONFIRMED';

  return (
    <Modal open={open} onClose={onClose} title="Xác nhận hủy đặt chỗ">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-xs text-rose-800 leading-relaxed flex items-start gap-3">
          <span className="material-symbols-outlined text-rose-600 text-xl flex-shrink-0 mt-0.5">warning</span>
          <div>
            <p className="font-bold mb-1">
              {isConfirmed
                ? 'Hủy đặt chỗ đã thanh toán'
                : 'Bạn có chắc chắn muốn hủy đặt chỗ này?'}
            </p>
            <p>
              {isConfirmed
                ? 'Đặt chỗ này đã được thanh toán. Sau khi bạn yêu cầu hủy, hệ thống sẽ tiếp nhận và tiến hành quy trình hoàn tiền theo chính sách hủy tour của nhà cung cấp.'
                : 'Chỗ giữ trên chuyến đi sẽ được giải phóng ngay lập tức để du khách khác có thể đặt chỗ.'}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-xs text-slate-600 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Mã đặt chỗ:</span>
            <span className="font-mono font-bold text-slate-800">{booking.bookingCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Chuyến đi:</span>
            <span className="font-semibold text-slate-800 truncate max-w-[240px]">{booking.tour.title}</span>
          </div>
        </div>

        <div>
          <label htmlFor="cancel-reason" className="block text-xs font-bold text-slate-700 mb-1.5">
            Lý do hủy (không bắt buộc)
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vui lòng chia sẻ lý do bạn hủy đặt chỗ (thay đổi kế hoạch, việc bận, v.v.)..."
            className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Đóng lại
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Xác nhận hủy</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
