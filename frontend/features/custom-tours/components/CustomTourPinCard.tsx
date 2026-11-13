'use client';

import { ChevronRight, Handshake } from 'lucide-react';
import type { RefObject } from 'react';
import { cn } from '@/components/ui';
import { STATUS_LABELS, guestSummary } from '../labels';
import type { CustomTourRequestDto } from '../types';

const dayLabel = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** The request's planned day: the agreed departure once offered, else the date the traveler asked for. */
export const requestDate = (request: Pick<CustomTourRequestDto, 'offer' | 'startDate'>): string | undefined => {
  const iso = request.offer?.departureDate ?? request.startDate;
  return iso ? dayLabel.format(new Date(iso)) : undefined;
};

export interface CustomTourPinCardProps {
  requests: CustomTourRequestDto[];
  selected: CustomTourRequestDto;
  onSelect: (requestId: string) => void;
  onOpen: () => void;
  openButtonRef: RefObject<HTMLButtonElement>;
}

export function CustomTourPinCard({ requests, selected, onSelect, onOpen, openButtonRef }: CustomTourPinCardProps) {
  const date = requestDate(selected);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-teal-100 bg-teal-50/70 px-3.5 py-2 sm:px-4">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-teal-900">
        <Handshake size={15} aria-hidden="true" /> Booking đoàn
      </span>
      <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_LABELS[selected.status].className)}>
        {STATUS_LABELS[selected.status].label}
      </span>
      {requests.length > 1 && (
        <select
          aria-label="Chọn yêu cầu đoàn"
          value={selected.id}
          onChange={(event) => onSelect(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
        >
          {requests.map((request) => (
            <option key={request.id} value={request.id}>
              {STATUS_LABELS[request.status].label} · {guestSummary(request)}
            </option>
          ))}
        </select>
      )}
      <span className="text-xs text-slate-600">
        {guestSummary(selected)}
        {date ? ` · ${date}` : ''}
      </span>
      <button
        ref={openButtonRef}
        type="button"
        onClick={onOpen}
        className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100"
      >
        Xem thỏa thuận <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
