'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/shared';
import { useGetTourQuery, useGetToursQuery } from '@/features/tours';
import { formatDepartureDate, formatVnd } from '../utils/format';
import { AddToCartButton } from './AddToCartButton';

export interface AddTourPanelProps {
  open: boolean;
  onToggle: (open: boolean) => void;
}

/**
 * "Add tour to cart" entry point inside the cart: browse the public tour list, pick a tour, pick one of its
 * bookable departures and add it with a head-count. The backend re-checks everything, so an invalid pick surfaces
 * its error on the `AddToCartButton`.
 */
export function AddTourPanel({ open, onToggle }: AddTourPanelProps) {
  const [tourId, setTourId] = useState<string | null>(null);
  const [participants, setParticipants] = useState(1);

  const { data: tours, isLoading, isError, refetch } = useGetToursQuery({ limit: 12 }, { skip: !open });
  const { data: detail, isLoading: isLoadingDetail } = useGetTourQuery(tourId ?? '', { skip: !open || !tourId });

  const departures = (detail?.departures ?? []).filter(
    (departure) => departure.isOpen && departure.remaining > 0 && new Date(departure.date).getTime() > Date.now(),
  );

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Thêm tour vào giỏ</h2>
          <p className="text-xs text-slate-500">Chọn một tour đang mở bán và một ngày khởi hành còn chỗ.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onToggle(!open)}>
          {open ? 'Đóng' : 'Chọn tour'}
        </Button>
      </div>

      {open && (
        <div className="mt-4">
          {isLoading && <LoadingState label="Đang tải danh sách tour..." />}
          {isError && <ErrorState message="Không tải được danh sách tour." onAction={refetch} />}

          {tours && tours.length === 0 && <p className="text-sm text-slate-500">Chưa có tour nào đang mở bán.</p>}

          {tours && tours.length > 0 && (
            <div>
              <label htmlFor="cart-add-tour" className="text-xs font-semibold text-slate-600">
                Tour
              </label>
              <select
                id="cart-add-tour"
                value={tourId ?? ''}
                onChange={(event) => setTourId(event.target.value || null)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              >
                <option value="">— Chọn tour —</option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.title} · {tour.destination}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tourId && isLoadingDetail && <LoadingState label="Đang tải ngày khởi hành..." />}
          {tourId && !isLoadingDetail && departures.length === 0 && (
            <p className="mt-3 text-xs font-medium text-amber-700">Tour này hiện không có ngày khởi hành nào còn chỗ.</p>
          )}

          {tourId && departures.length > 0 && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <label htmlFor="cart-add-participants" className="text-xs font-semibold text-slate-600">
                  Số khách
                </label>
                <input
                  id="cart-add-participants"
                  type="number"
                  min={1}
                  max={50}
                  value={participants}
                  onChange={(event) => setParticipants(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
                  className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                />
              </div>
              <ul className="space-y-2">
                {departures.map((departure) => (
                  <li
                    key={departure.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-surface-container-lowest px-3 py-2"
                  >
                    <span className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{formatDepartureDate(departure.date)}</span>
                      {' · '}
                      {formatVnd(departure.price)}
                      {' · '}còn {departure.remaining} chỗ
                    </span>
                    <AddToCartButton
                      tourId={tourId}
                      departureId={departure.id}
                      participants={Math.min(participants, departure.remaining)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
