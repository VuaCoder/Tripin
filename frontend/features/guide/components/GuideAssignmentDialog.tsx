'use client';

import { useEffect, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import type { GuideAssignedTour } from '../types';

const NOTE_MAX = 500;

interface GuideAssignmentDialogProps {
  open: boolean;
  tour: GuideAssignedTour | null;
  accept: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => void;
}

/** The optional note is sent with the answer and shown to the agency. */
export function GuideAssignmentDialog({
  open,
  tour,
  accept,
  isLoading,
  onClose,
  onConfirm,
}: GuideAssignmentDialogProps) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop={!isLoading}
      title={accept ? 'Nhận tour được phân công' : 'Từ chối tour được phân công'}
    >
      <p className="text-sm text-slate-600">
        {accept
          ? 'Bạn xác nhận sẽ phụ trách tour này. Đại lý sẽ nhận được thông báo.'
          : 'Bạn từ chối tour này. Hãy cho đại lý biết lý do để họ sắp xếp hướng dẫn viên khác.'}
      </p>
      {tour && <p className="mt-2 text-sm font-bold text-slate-900">{tour.title}</p>}

      <label htmlFor="guide-answer-note" className="mt-4 block text-sm font-semibold text-slate-700">
        Ghi chú (không bắt buộc)
      </label>
      <textarea
        id="guide-answer-note"
        rows={3}
        maxLength={NOTE_MAX}
        value={note}
        disabled={isLoading}
        onChange={(event) => setNote(event.target.value)}
        placeholder={accept ? 'Ví dụ: Tôi sẽ có mặt trước giờ khởi hành 30 phút.' : 'Ví dụ: Tôi đã có lịch dẫn tour khác trong ngày này.'}
        className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
      <p className="mt-1 text-xs text-slate-500">
        {note.length}/{NOTE_MAX} ký tự
      </p>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
          Hủy
        </Button>
        <Button
          type="button"
          variant={accept ? 'primary' : 'danger'}
          loading={isLoading}
          loadingLabel="Đang gửi..."
          onClick={() => onConfirm(note.trim() || undefined)}
        >
          {accept ? 'Xác nhận nhận tour' : 'Xác nhận từ chối'}
        </Button>
      </div>
    </Modal>
  );
}
