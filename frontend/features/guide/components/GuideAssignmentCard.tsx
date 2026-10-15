'use client';

import { Badge, Button } from '@/components/ui';
import { formatDepartureDate, formatDuration, formatVnd } from '@/features/tours/utils';
import type { GuideAssignedTour, GuideAssignmentStatus } from '../types';

const STATUS_LABELS: Record<GuideAssignmentStatus, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: 'Chờ bạn xác nhận', variant: 'warning' },
  ACCEPTED: { label: 'Đã nhận tour', variant: 'success' },
  DECLINED: { label: 'Đã từ chối', variant: 'danger' },
};

interface GuideAssignmentCardProps {
  tour: GuideAssignedTour;
  onAnswer: (tour: GuideAssignedTour, accept: boolean) => void;
}

export function GuideAssignmentCard({ tour, onAnswer }: GuideAssignmentCardProps) {
  const status = STATUS_LABELS[tour.assignment.status] ?? STATUS_LABELS.PENDING;
  const isPending = tour.assignment.status === 'PENDING';

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900">{tour.title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {tour.destination} · {formatDuration(tour.durationDays)}
            {tour.agency?.name ? ` · ${tour.agency.name}` : ''}
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thù lao mỗi booking</dt>
          <dd className="mt-1 font-semibold text-slate-800">{formatVnd(tour.assignment.feePerBooking)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Khởi hành gần nhất</dt>
          <dd className="mt-1 font-semibold text-slate-800">{formatDepartureDate(tour.nextDepartureDate)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phản hồi</dt>
          <dd className="mt-1 font-semibold text-slate-800">
            {tour.assignment.respondedAt ? formatDepartureDate(tour.assignment.respondedAt) : 'Chưa phản hồi'}
          </dd>
        </div>
      </dl>

      {isPending && (
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onAnswer(tour, false)}>
            Từ chối
          </Button>
          <Button onClick={() => onAnswer(tour, true)}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
            Nhận tour
          </Button>
        </div>
      )}
    </article>
  );
}
