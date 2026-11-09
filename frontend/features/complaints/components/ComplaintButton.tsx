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
  iconOnly?: boolean;
}

export function ComplaintButton({
  tourId,
  tourTitle,
  bookingId,
  bookingCode,
  className,
  iconOnly = false,
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
          aria-label={`Đã mở phiếu (${sentCode})`}
          title={`Đã mở phiếu (${sentCode})`}
          className={
            iconOnly
              ? 'inline-flex size-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 transition hover:bg-emerald-100 shadow-2xs'
              : 'inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 shadow-2xs'
          }
        >
          <CheckCircle2 className={`${iconOnly ? 'size-5' : 'size-4'} text-emerald-600 shrink-0`} />
          {!iconOnly && <span>Đã mở phiếu ({sentCode})</span>}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Khiếu nại dịch vụ"
          title="Khiếu nại dịch vụ"
          className={
            iconOnly
              ? 'inline-flex size-10 items-center justify-center rounded-full border border-amber-200 bg-amber-50/50 text-amber-800 transition-colors hover:bg-amber-100/80 cursor-pointer shadow-2xs active:scale-95'
              : 'inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100/80 cursor-pointer'
          }
        >
          <AlertCircle className={`${iconOnly ? 'size-5' : 'size-4'} text-amber-600 shrink-0`} />
          {!iconOnly && <span>Khiếu nại dịch vụ</span>}
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
