'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDepartureDate, formatParticipants, formatVnd } from '@/features/cart';
import type { ETicketDto } from '../types';
import { QRCodeDisplay } from './QRCodeDisplay';

export interface ETicketCardProps {
  ticket: ETicketDto;
  onClose?: () => void;
  showBackToBooking?: boolean;
}

export function ETicketCard({ ticket, onClose, showBackToBooking = true }: ETicketCardProps) {
  const isPrintable = ticket.status === 'VALID' || ticket.status === 'USED';

  const handlePrint = () => {
    window.print();
  };

  const statusConfig = {
    VALID: {
      label: 'VÉ HỢP LỆ · SẴN SÀNG',
      bg: 'bg-emerald-500/10 text-emerald-800 border-emerald-300/60',
      dot: 'bg-emerald-500',
      icon: 'verified',
    },
    USED: {
      label: 'ĐÃ HOÀN TẤT · ĐÃ SỬ DỤNG',
      bg: 'bg-slate-500/10 text-slate-800 border-slate-300/60',
      dot: 'bg-slate-400',
      icon: 'done_all',
    },
    CANCELLED: {
      label: 'ĐÃ HỦY · KHÔNG CÒN HIỆU LỰC',
      bg: 'bg-rose-500/10 text-rose-800 border-rose-300/60',
      dot: 'bg-rose-500',
      icon: 'cancel',
    },
  }[ticket.status];

  const departureDateFormatted = formatDepartureDate(ticket.departureDate);
  const formattedIssuedAt = new Date(ticket.issuedAt).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="eticket-wrapper mx-auto max-w-3xl space-y-4">
      {/* Action Header for Screen (hidden when printing) */}
      <div className="no-print flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="material-symbols-outlined text-[18px] text-primary-container">airplane_ticket</span>
          <span>Vé điện tử chính thức từ Tripri</span>
        </div>

        <div className="flex items-center gap-2">
          {isPrintable && (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-primary-container transition-all"
            >
              <span className="material-symbols-outlined text-[17px]">print</span>
              <span>In vé / Lưu PDF</span>
            </button>
          )}

          {showBackToBooking && (
            <Link
              href={`/settings/history/${ticket.booking.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-container/10 px-3.5 py-2 text-xs font-bold text-primary-container hover:bg-primary-container/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[17px]">arrow_back</span>
              <span>Xem đặt chỗ</span>
            </Link>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Đóng"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Boarding Pass Container */}
      <article
        id="eticket-printable-card"
        className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl transition-shadow"
      >
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-primary-container p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20">
                <Image
                  src="/images/tripri-logo.png"
                  alt="Tripri"
                  width={34}
                  height={34}
                  className="brightness-0 invert object-contain"
                />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-teal-200">
                  Electronic Tour Ticket
                </span>
                <h1 className="text-lg font-black tracking-tight leading-tight">
                  VÉ ĐIỆN TỬ XÁC NHẬN CHUYẾN ĐI
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-wide bg-white text-slate-900 border-white/90 shadow-sm`}
              >
                <span className={`h-2 w-2 rounded-full ${statusConfig.dot} animate-pulse`} />
                <span>{statusConfig.label}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tour Title & Destination Hero */}
        <div className="border-b border-slate-100 bg-teal-50/40 p-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
              {ticket.tour.destination && (
                <span className="inline-flex items-center gap-1 text-teal-800 font-bold bg-teal-100/70 px-2.5 py-0.5 rounded-md">
                  <span className="material-symbols-outlined text-[15px]">location_on</span>
                  {ticket.tour.destination}
                </span>
              )}
              {ticket.tour.durationDays && (
                <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md">
                  <span className="material-symbols-outlined text-[15px]">schedule</span>
                  {ticket.tour.durationDays} ngày
                </span>
              )}
              <span className="font-mono text-slate-400">Mã đơn: #{ticket.booking.code}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {ticket.tour.title}
            </h2>
          </div>
        </div>

        {/* Middle Body: 2 Columns (Info & QR stub) */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Traveler & Booking Details (7 cols) */}
          <div className="p-6 space-y-6 lg:col-span-7 lg:border-r lg:border-dashed lg:border-slate-200">
            {/* Section: Traveler Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary-container">person</span>
                <span>Thông tin hành khách</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 p-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Người đại diện đặt chỗ</span>
                  <strong className="text-slate-900 font-bold text-sm block mt-0.5 truncate">
                    {ticket.holderName}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">Số lượng khách</span>
                  <strong className="text-slate-900 font-bold text-sm block mt-0.5">
                    {formatParticipants(ticket.participants)}
                  </strong>
                </div>

                {ticket.booking.contactPhone && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Điện thoại liên hệ</span>
                    <strong className="text-slate-800 font-semibold block mt-0.5">
                      {ticket.booking.contactPhone}
                    </strong>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block text-[11px]">Ngày khởi hành</span>
                  <strong className="text-teal-900 font-bold block mt-0.5">
                    {departureDateFormatted}
                  </strong>
                </div>
              </div>
            </div>

            {/* Section: Payment & Booking Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary-container">receipt_long</span>
                <span>Chi tiết thanh toán & Đặt chỗ</span>
              </h3>

              <div className="space-y-2.5 rounded-2xl bg-slate-50/80 border border-slate-100 p-4 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Trạng thái thanh toán</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    ĐÃ THANH TOÁN (PayOS)
                  </span>
                </div>

                {ticket.booking.totalAmount != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Tổng tiền đã trả</span>
                    <strong className="text-sm font-extrabold text-primary-container">
                      {formatVnd(ticket.booking.totalAmount)}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Thời gian cấp vé</span>
                  <span className="font-medium text-slate-700">{formattedIssuedAt}</span>
                </div>

                <div className="flex justify-between items-center border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">Mã vé (Ticket ID)</span>
                  <span className="font-mono text-[11px] font-semibold text-slate-600">{ticket.id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: QR Code & Security Seal Stub (5 cols) */}
          <div className="relative p-6 flex flex-col items-center justify-between gap-6 bg-gradient-to-b from-slate-50/40 to-slate-100/60 lg:col-span-5">
            <div className="w-full text-center">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                Mã xác thực lên tour
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Xuất trình khi gặp trưởng đoàn / check-in
              </p>
            </div>

            {/* QR Code */}
            <div className="my-auto">
              <QRCodeDisplay value={ticket.code} size={170} />
            </div>

            {/* Simulated Barcode */}
            <div className="w-full text-center space-y-1">
              <div className="mx-auto flex h-9 max-w-[200px] items-center justify-between opacity-70">
                {[4, 2, 6, 3, 2, 8, 3, 5, 2, 7, 4, 2, 5, 3, 6, 2, 8, 3, 2, 5].map((w, i) => (
                  <span
                    key={i}
                    style={{ width: `${w}px` }}
                    className="h-full bg-slate-800 rounded-sm inline-block"
                  />
                ))}
              </div>
              <span className="block font-mono text-[10px] text-slate-400 tracking-widest uppercase">
                SECURITY VERIFIED · TRIPRI GUARANTEE
              </span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="border-t border-slate-100 bg-slate-50 p-4 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-1.5 text-teal-800 font-semibold">
            <span className="material-symbols-outlined text-base">info</span>
            <span>Vui lòng mang theo CCCD/Hộ chiếu trùng khớp tên người liên hệ khi tham gia tour.</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/tours/${ticket.tour.id}`}
              className="no-print font-semibold text-primary-container hover:underline"
            >
              Xem trang đánh giá tour →
            </Link>
            <span className="text-slate-400 font-mono text-[10px]">
              Hỗ trợ 24/7: support@tripri.vn
            </span>
          </div>
        </div>
      </article>

      {/* Embedded print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          #eticket-printable-card,
          #eticket-printable-card * {
            visibility: visible;
          }
          #eticket-printable-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
