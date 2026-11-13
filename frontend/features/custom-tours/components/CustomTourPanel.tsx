'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/components/ui';
import { STATUS_LABELS } from '../labels';
import type { CustomTourRequestDto } from '../types';
import { AgencyOfferEditor } from './AgencyOfferEditor';
import { TravelerOfferReview } from './TravelerOfferReview';

export interface CustomTourPanelProps {
  request: CustomTourRequestDto;
  isAgency: boolean;
  onClose: () => void;
  onRefetch: () => void;
}

/**
 * The offer of a conversation as a centred dialog over a dimmed page. The native dialog supplies the modal
 * layer, focus trapping, Escape handling and the return of focus to the card when it closes.
 */
export function CustomTourPanel({ request, isAgency, onClose, onRefetch }: CustomTourPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // The traveler reads the negotiated title from the offer; the agency reads the clone it is editing.
  const title = (isAgency ? request.privateTour?.title : request.offer?.content?.title)
    ?? request.privateTour?.title ?? request.sourceTour?.title ?? 'Tour riêng của đoàn';

  // Effects run twice in development StrictMode, and showModal throws on an open dialog.
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label="Thỏa thuận booking đoàn"
      onClose={() => onCloseRef.current()}
      className="animate-dialog-in dialog-scrim m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-start gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Thỏa thuận booking đoàn</p>
            <p className="truncate text-sm font-bold text-slate-900">{title}</p>
            <span className={cn('mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_LABELS[request.status].className)}>
              {STATUS_LABELS[request.status].label}
            </span>
          </div>
          <button
            type="button"
            aria-label="Đóng thỏa thuận"
            onClick={() => dialog.current?.close()}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isAgency
            ? <AgencyOfferEditor request={request} onRefetch={onRefetch} />
            : <TravelerOfferReview request={request} onRefetch={onRefetch} />}
        </div>
      </div>
    </dialog>
  );
}
