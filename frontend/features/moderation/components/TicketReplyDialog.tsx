'use client';

import { useEffect, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/shared';
import { TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, TICKET_TEXT_MAX, validateTicketText } from '../labels';
import type { ModerationTicket } from '../types';

interface TicketReplyDialogProps {
  open: boolean;
  /** The detail is read on selection: the list row carries no conversation. */
  ticket: ModerationTicket | null;
  isLoading: boolean;
  /** The detail read failed; the dialog offers a retry instead of an empty conversation. */
  isError?: boolean;
  onRetry?: () => void;
  isSubmitting: boolean;
  /** Message returned by the backend for the last attempt; keeps the dialog open. */
  serverError?: string | null;
  onClose: () => void;
  onReply: (input: { text: string; resolve: boolean }) => void;
  onSetStatus: (status: 'IN_PROGRESS' | 'RESOLVED') => void;
}

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** Use case "Handle complaints": the ticket conversation, the moderator's reply and the status change. */
export function TicketReplyDialog({
  open,
  ticket,
  isLoading,
  isError = false,
  onRetry,
  isSubmitting,
  serverError,
  onClose,
  onReply,
  onSetStatus,
}: TicketReplyDialogProps) {
  const [text, setText] = useState('');
  const [resolve, setResolve] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setResolve(false);
      setError(null);
    }
  }, [open, ticket?.id]);

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateTicketText(text);
    setError(found);
    if (found) return;
    onReply({ text: text.trim(), resolve });
  };

  // A resolved or closed ticket accepts nothing (`replyAsStaff` / `setStatus` refuse it).
  const canReply = ticket?.status === 'OPEN' || ticket?.status === 'IN_PROGRESS';

  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop={!isSubmitting} title="Chi tiết khiếu nại hỗ trợ" className="max-h-[90vh] max-w-2xl overflow-y-auto">
      {isLoading ? (
        <LoadingState label="Đang tải nội dung khiếu nại..." />
      ) : isError || !ticket ? (
        <ErrorState title="Không thể tải khiếu nại" message="Đã có lỗi xảy ra khi đọc nội dung khiếu nại." onAction={onRetry} />
      ) : (
        <div className="space-y-3 text-sm">
          {serverError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {serverError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TICKET_STATUS_LABELS[ticket.status].className}`}>
              {TICKET_STATUS_LABELS[ticket.status].label}
            </span>
            <span className="text-slate-600">{TICKET_CATEGORY_LABELS[ticket.category]}</span>
          </div>
          <p className="text-base font-bold text-slate-900">{ticket.subject}</p>
          <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2 rounded-xl border border-slate-100 p-3 text-xs">
            <dt className="text-slate-500">Người gửi</dt>
            <dd className="font-semibold break-words text-slate-800">{ticket.userName ?? 'Không xác định'}</dd>
            {ticket.bookingCode && (
              <>
                <dt className="text-slate-500">Đơn đặt chỗ</dt>
                <dd className="font-semibold text-slate-800">{ticket.bookingCode}</dd>
              </>
            )}
            {ticket.assignedToName && (
              <>
                <dt className="text-slate-500">Đang phụ trách</dt>
                <dd className="font-semibold break-words text-slate-800">{ticket.assignedToName}</dd>
              </>
            )}
          </dl>

          <ol className="space-y-2">
            {ticket.messages.map((m, index) => (
              <li
                key={`${m.createdAt}-${index}`}
                className={`rounded-xl border p-3 ${m.author === 'SUPPORT' ? 'border-purple-100 bg-purple-50' : 'border-slate-100 bg-slate-50'}`}
              >
                <p className="text-xs font-bold text-slate-600">
                  {m.author === 'SUPPORT' ? 'Hỗ trợ' : 'Du khách'} · {dateTime.format(new Date(m.createdAt))}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{m.text}</p>
              </li>
            ))}
          </ol>

          {canReply ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-2 border-t border-slate-100 pt-3">
              <label htmlFor="ticket-reply" className="block text-sm font-semibold text-slate-700">
                Trả lời du khách
              </label>
              <textarea
                id="ticket-reply"
                rows={4}
                maxLength={TICKET_TEXT_MAX}
                value={text}
                disabled={isSubmitting}
                onChange={(e) => setText(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'ticket-reply-error' : undefined}
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-50"
              />
              {error && (
                <p id="ticket-reply-error" role="alert" className="text-xs font-semibold text-red-600">
                  {error}
                </p>
              )}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={resolve} disabled={isSubmitting} onChange={(e) => setResolve(e.target.checked)} />
                Đánh dấu khiếu nại đã được giải quyết
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                  Đóng
                </Button>
                {ticket.status === 'OPEN' && (
                  <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onSetStatus('IN_PROGRESS')}>
                    Tiếp nhận xử lý
                  </Button>
                )}
                {ticket.status === 'IN_PROGRESS' && (
                  <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onSetStatus('RESOLVED')}>
                    Đã giải quyết
                  </Button>
                )}
                <Button type="submit" loading={isSubmitting} loadingLabel="Đang gửi...">
                  Gửi trả lời
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Đóng
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
