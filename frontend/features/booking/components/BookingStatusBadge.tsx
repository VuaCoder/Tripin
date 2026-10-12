import React from 'react';
import type { BookingStatus } from '../types';

export interface BookingStatusBadgeProps {
  status: BookingStatus;
  isPaid?: boolean;
  refundRequired?: boolean;
  className?: string;
}

export function BookingStatusBadge({
  status,
  isPaid,
  refundRequired,
  className = '',
}: BookingStatusBadgeProps) {
  let statusBg = 'bg-slate-100 text-slate-700 border-slate-200';
  let statusIcon = 'info';
  let statusText = 'Không xác định';

  switch (status) {
    case 'PENDING':
      statusBg = 'bg-amber-50 text-amber-800 border-amber-200/80';
      statusIcon = 'schedule';
      statusText = 'Chờ thanh toán';
      break;
    case 'CONFIRMED':
      statusBg = 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      statusIcon = 'check_circle';
      statusText = 'Đã xác nhận';
      break;
    case 'COMPLETED':
      statusBg = 'bg-teal-50 text-teal-800 border-teal-200/80';
      statusIcon = 'task_alt';
      statusText = 'Đã hoàn thành';
      break;
    case 'CANCELLED':
      statusBg = 'bg-rose-50 text-rose-700 border-rose-200/80';
      statusIcon = 'cancel';
      statusText = 'Đã hủy';
      break;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {/* Booking Lifecycle Status Badge */}
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusBg}`}
      >
        <span className="material-symbols-outlined text-[15px]">{statusIcon}</span>
        <span>{statusText}</span>
      </span>

      {/* Payment Status Pill */}
      {refundRequired ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border bg-purple-50 text-purple-700 border-purple-200">
          <span className="material-symbols-outlined text-[14px]">currency_exchange</span>
          <span>Chờ hoàn tiền</span>
        </span>
      ) : isPaid ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border bg-primary-container/10 text-primary border-primary-container/20">
          <span className="material-symbols-outlined text-[14px]">payments</span>
          <span>Đã thanh toán</span>
        </span>
      ) : status === 'PENDING' ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-50 text-slate-600 border-slate-200">
          <span className="material-symbols-outlined text-[14px]">pending</span>
          <span>Chưa thanh toán</span>
        </span>
      ) : null}
    </div>
  );
}
