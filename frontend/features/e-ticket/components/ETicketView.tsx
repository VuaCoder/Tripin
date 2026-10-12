'use client';

import React from 'react';
import Link from 'next/link';
import { LoadingState } from '@/components/shared';
import { useGetBookingByIdQuery } from '@/features/booking';
import { useGetETicketByBookingIdQuery, useGetETicketByIdQuery } from '../api/eTicketApi';
import { ETicketCard } from './ETicketCard';
import { ETicketNotEligible } from './ETicketNotEligible';

export interface ETicketViewProps {
  bookingId?: string;
  ticketId?: string;
}

export function ETicketView({ bookingId, ticketId }: ETicketViewProps) {
  // Query by bookingId or ticketId
  const {
    data: ticketByBooking,
    isLoading: isLoadingBookingTicket,
    isError: isErrorBookingTicket,
  } = useGetETicketByBookingIdQuery(bookingId ?? '', {
    skip: !bookingId,
  });

  const {
    data: ticketById,
    isLoading: isLoadingIdTicket,
    isError: isErrorIdTicket,
  } = useGetETicketByIdQuery(ticketId ?? '', {
    skip: !ticketId,
  });

  // Also query booking to know context if ticket is not issued yet
  const {
    data: booking,
    isLoading: isLoadingBooking,
  } = useGetBookingByIdQuery(bookingId ?? '', {
    skip: !bookingId,
  });

  const isLoading = (bookingId ? isLoadingBookingTicket || isLoadingBooking : false) || (ticketId ? isLoadingIdTicket : false);
  const ticket = ticketByBooking || ticketById;
  const isError = (bookingId ? isErrorBookingTicket : false) || (ticketId ? isErrorIdTicket : false);

  if (isLoading) {
    return (
      <div className="py-20">
        <LoadingState label="Đang kiểm tra thông tin vé điện tử..." />
      </div>
    );
  }

  // If ticket is found and loaded
  if (ticket) {
    return (
      <div className="py-6 sm:py-8 px-4 sm:px-6">
        <ETicketCard ticket={ticket} />
      </div>
    );
  }

  // If ticket is not found but booking is loaded and not paid/confirmed
  if (booking && (!booking.isPaid || booking.status !== 'CONFIRMED')) {
    return (
      <div className="py-12 px-4 sm:px-6">
        <ETicketNotEligible booking={booking} bookingId={bookingId} />
      </div>
    );
  }

  // Other cases: 404 (IDOR or non-existent ticket)
  return (
    <div className="py-16 px-4">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 border border-rose-100 text-rose-600">
          <span className="material-symbols-outlined text-3xl">lock</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Không tìm thấy vé điện tử</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Vé điện tử này không tồn tại trong hệ thống, chưa được phát hành, hoặc bạn không có quyền truy cập vé của hành khách khác.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {bookingId && (
            <Link
              href={`/settings/history/${bookingId}`}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Xem chi tiết đặt chỗ
            </Link>
          )}
          <Link
            href="/settings/history"
            className="rounded-xl bg-primary-container px-5 py-2.5 text-xs font-bold text-white hover:bg-primary transition-colors"
          >
            Về danh sách chuyến đi
          </Link>
        </div>
      </div>
    </div>
  );
}
