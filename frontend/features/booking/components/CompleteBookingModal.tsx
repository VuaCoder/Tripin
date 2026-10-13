import React from 'react';
import { Modal } from '@/components/ui';
import type { BookingDto } from '../types';

export interface CompleteBookingModalProps {
  open: boolean;
  booking: BookingDto | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (bookingId: string) => Promise<void>;
}

export function CompleteBookingModal({
  open,
  booking,
  isLoading,
  onClose,
  onConfirm,
}: CompleteBookingModalProps) {
  if (!booking) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(booking.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="Xác nhận hoàn thành chuyến đi">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl bg-teal-50 border border-teal-100 p-4 text-xs text-teal-900 leading-relaxed flex items-start gap-3">
          <span className="material-symbols-outlined text-teal-700 text-2xl flex-shrink-0 mt-0.5">
            verified
          </span>
          <div>
            <p className="font-bold text-sm mb-1 text-teal-950">
              Bạn đã trải nghiệm xong tour du lịch này?
            </p>
            <p className="text-teal-800 leading-relaxed">
              Sau khi xác nhận hoàn thành, chuyến đi của bạn sẽ chuyển sang trạng thái <strong>Đã hoàn thành</strong>.
              Bạn có thể tiến hành viết đánh giá, chấm điểm sao và chia sẻ trải nghiệm thực tế của mình để giúp cộng đồng du khách có thêm thông tin hữu ích!
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-xs text-slate-600 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Mã đặt chỗ:</span>
            <span className="font-mono font-bold text-slate-800">{booking.bookingCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tour:</span>
            <span className="font-semibold text-slate-800 truncate max-w-[240px]">{booking.tour.title}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">task_alt</span>
            <span>{isLoading ? 'Đang xác nhận...' : 'Xác nhận hoàn thành'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
