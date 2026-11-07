'use client';

import { useRouter } from 'next/navigation';
import { useGetMyBookingsQuery } from '../api/bookingApi';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80';

function formatDatesShort(depIso?: string, endIso?: string): string {
  if (!depIso) return '';
  const dep = new Date(depIso);
  if (isNaN(dep.getTime())) return '';
  const depDay = dep.getDate();
  const depMonth = dep.getMonth() + 1;

  if (endIso) {
    const end = new Date(endIso);
    if (!isNaN(end.getTime())) {
      const endDay = end.getDate();
      const endMonth = end.getMonth() + 1;
      if (depMonth === endMonth) {
        return `${depDay} – ${endDay} thg ${depMonth}`;
      }
      return `${depDay} thg ${depMonth} – ${endDay} thg ${endMonth}`;
    }
  }

  return `${depDay} thg ${depMonth}`;
}

export function IncompleteBookingBanner() {
  const router = useRouter();
  const { data: bookingsData, isLoading } = useGetMyBookingsQuery({ limit: 5 });

  if (isLoading || !bookingsData?.items) return null;

  // Find incomplete / pending booking
  const incompleteBooking = bookingsData.items.find(
    (b) => b.status === 'PENDING' || (!b.isPaid && b.status !== 'CANCELLED'),
  );

  if (!incompleteBooking) return null;

  const datesText = formatDatesShort(
    incompleteBooking.departureDate,
    incompleteBooking.endDate,
  );
  const locationText =
    (incompleteBooking.tour as any)?.destination ||
    incompleteBooking.tour?.title ||
    'chuyến đi';
  const coverImage =
    (incompleteBooking.tour as any)?.coverImage || DEFAULT_COVER;

  return (
    <aside
      onClick={() => router.push(`/settings/history/${incompleteBooking.id}`)}
      className="group mb-8 flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer select-none"
      aria-label="Tiếp tục hoàn tất đặt tour"
    >
      {/* Thumbnail */}
      <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
        <img
          src={coverImage}
          alt={locationText}
          className="size-full object-cover"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_COVER;
          }}
        />
      </div>

      {/* Text Banner: "Hoàn tất quy trình đặt tour của bạn tại [Địa điểm] [Ngày] · [Số] khách →" */}
      <div className="flex-1 min-w-0 text-sm font-medium text-slate-800">
        <span>Hoàn tất quy trình đặt tour của bạn tại </span>
        <span className="font-semibold text-slate-900">{locationText}</span>
        {datesText && (
          <span className="text-slate-600"> {datesText}</span>
        )}
        <span className="text-slate-600"> · {incompleteBooking.participants} khách</span>
      </div>

      {/* Arrow Icon */}
      <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-800 group-hover:translate-x-0.5 transition-all text-[20px] pr-1 shrink-0">
        arrow_forward
      </span>
    </aside>
  );
}

