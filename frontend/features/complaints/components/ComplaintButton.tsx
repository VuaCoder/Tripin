'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { ComplaintTicketDialog } from './ComplaintTicketDialog';

interface ComplaintButtonProps {
  tourId: string;
  tourTitle?: string;
  bookingId?: string;
  bookingCode?: string;
  className?: string;
}

export function ComplaintButton({
  tourId,
  tourTitle,
  bookingId,
  bookingCode,
  className,
}: ComplaintButtonProps) {
  const allowed = useAppSelector(selectUser)?.permissions.includes('report:create') ?? false;
  const [open, setOpen] = useState(false);
  const [sentCode, setSentCode] = useState<string | null>(null);

  if (!allowed) return null;

  return (
    <div className={className}>
      {sentCode ? (
        <Link
          href="/conversations?tab=complaints"
          role="status"
          title="Nhấn để theo dõi và trao đổi trong Hộp thư tin nhắn"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 shadow-2xs"
        >
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>Đã mở phiếu ({sentCode})</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100/80 cursor-pointer"
        >
          <AlertCircle className="size-4 text-amber-600" />
          <span>Khiếu nại dịch vụ</span>
        </button>
      )}

      <ComplaintTicketDialog
        open={open}
        tourId={tourId}
        tourTitle={tourTitle}
        bookingId={bookingId}
        bookingCode={bookingCode}
        onClose={() => setOpen(false)}
        onSuccess={(code) => setSentCode(code)}
      />
    </div>
  );
}
