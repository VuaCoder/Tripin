import React from 'react';
import type { BookingStatus } from '../types';

export interface BookingStatusBadgeProps {
  status: BookingStatus;
  isPaid?: boolean;
  refundRequired?: boolean;
  className?: string;
}

/**
 * One pill for the whole lifecycle: later states override earlier ones, so the card never lists
 * "Đã xác nhận" and "Đã thanh toán" side by side.
 */
export function BookingStatusBadge({
  status,
  isPaid,
  refundRequired,
  className = '',
}: BookingStatusBadgeProps) {
  let tone = 'bg-slate-100 text-slate-700 border-slate-200';
  let icon = 'info';
  let label = 'Không xác định';

  if (status === 'CANCELLED') {
    tone = 'bg-rose-50 text-rose-700 border-rose-200/80';
    icon = 'cancel';
    label = 'Đã hủy';
  } else if (refundRequired) {
    tone = 'bg-purple-50 text-purple-700 border-purple-200';
    icon = 'currency_exchange';
    label = 'Chờ hoàn tiền';
  } else if (status === 'COMPLETED') {
    tone = 'bg-teal-50 text-teal-800 border-teal-200/80';
    icon = 'task_alt';
    label = 'Đã hoàn thành';
  } else if (isPaid) {
    tone = 'bg-primary-container/10 text-primary border-primary-container/20';
    icon = 'payments';
    label = 'Đã thanh toán';
  } else if (status === 'CONFIRMED') {
    tone = 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    icon = 'check_circle';
    label = 'Đã xác nhận';
  } else if (status === 'PENDING') {
    tone = 'bg-amber-50 text-amber-800 border-amber-200/80';
    icon = 'schedule';
    label = 'Chờ thanh toán';
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${tone} ${className}`}>
      <span className="material-symbols-outlined text-[15px]" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  );
}
