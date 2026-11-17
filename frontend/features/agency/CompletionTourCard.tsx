'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Clock3, ImageOff, MapPin, Users } from 'lucide-react';
import type { CompletionQueue } from './completionApi';
import { agencyButton } from './AgencyCommon';
import { formatDuration } from '@/features/tours/utils';

type Trip = CompletionQueue['items'][number];
const date = (value: string) => new Date(value).toLocaleDateString('vi-VN');

export function CompletionTourCard({ trip, history, onOpen, href, actionLabel, footerNote }: { trip: Trip; history: boolean; onOpen?: () => void; href?: string; actionLabel?: string; footerNote?: string }) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const overdue = !history && Date.now() - Date.parse(trip.endAt) >= 3 * 86400000;
  const status = history ? trip.hasReport ? 'Đã gửi báo cáo' : 'Chưa có báo cáo Agency' : overdue ? 'Quá hạn gửi báo cáo' : 'Chờ hoàn tất';
  const label = actionLabel ?? (history ? trip.hasReport ? 'Xem báo cáo & lịch sử' : 'Xem chi tiết chuyến đi' : 'Lập báo cáo & hoàn tất');
  return <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white sm:flex-row">
    <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-teal-50 sm:aspect-auto sm:w-56 lg:w-64">
      {trip.coverImage && failedCover !== trip.coverImage ? <img src={trip.coverImage} alt={trip.title} onError={() => setFailedCover(trip.coverImage!)} className="h-full w-full object-cover sm:absolute sm:inset-0" />
        : <div className="flex h-full min-h-44 flex-col items-center justify-center gap-2 px-4 text-teal-800"><ImageOff className="h-8 w-8" aria-hidden="true" /><span className="text-sm">Chưa có ảnh tour</span></div>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {trip.destination && <p className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-600"><MapPin className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" /><span className="break-words">{trip.destination}</span></p>}
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${history && trip.hasReport ? 'bg-teal-50 text-teal-900' : 'bg-amber-50 text-amber-900'}`}>{status}</span>
      </div>
      <h2 className="break-words text-base font-bold leading-snug text-slate-900 sm:text-lg">{trip.title}</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
        {trip.durationDays != null && <p className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />{formatDuration(trip.durationDays)}</p>}
        <p className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{date(trip.departureAt)} — {date(trip.endAt)}</span></p>
        <p className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 shrink-0" aria-hidden="true" />{trip.bookingCount} booking · {trip.participants} khách</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="min-w-0 space-y-1"><p className="text-xs text-slate-600">{history ? trip.hasReport ? trip.completedAt ? `Hoàn tất ngày ${date(trip.completedAt)}` : 'Đã hoàn tất' : 'Hoàn tất theo luồng cũ' : 'Chuyến đi đã kết thúc'}</p>
          {footerNote && <p className="break-words text-xs text-slate-600">{footerNote}</p>}</div>
        {href ? <Link href={href} className={`${agencyButton} w-full sm:w-auto`}>{label}</Link> : <button type="button" className={`${agencyButton} w-full sm:w-auto`} onClick={onOpen}>{label}</button>}
      </div>
    </div>
  </article>;
}
