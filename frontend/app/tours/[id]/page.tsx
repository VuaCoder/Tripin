'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, MapPin } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/shared';
import { WishlistButton } from '@/features/wishlist';
import { formatDepartureDate } from '@/features/cart';
import { selectIsAuthenticated, selectRole } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { RatingStars, TourReviewsSection, formatDuration, formatVnd, useGetTourDetailQuery } from '@/features/review';

/**
 * Thin public tour page: enough context for the reviews block ("View public review" / "Write a review").
 * The full tour detail design (gallery, itinerary, departures, booking CTA) is a separate task — this page
 * deliberately stays a header plus the reviews section.
 */
export default function TourDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tourId = typeof params?.id === 'string' ? params.id : '';
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);
  const [selectedDepartureId, setSelectedDepartureId] = useState('');
  const [participants, setParticipants] = useState(1);

  const { data: tour, isLoading, isError, refetch } = useGetTourDetailQuery(tourId, { skip: !tourId });

  return (
    <>
      <Link
        href="/tours"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-primary-container"
      >
        <ArrowLeft className="size-4" /> Danh sách tour
      </Link>

      {!tourId || isError ? (
        <div className="mt-6">
          <ErrorState
            title="Không tìm thấy tour"
            message="Tour này không tồn tại hoặc đã ngừng hiển thị."
            actionLabel="Thử lại"
            onAction={refetch}
          />
        </div>
      ) : isLoading || !tour ? (
        <LoadingState label="Đang tải thông tin tour..." className="mt-6" />
      ) : (
        <>
          <article className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            {tour.coverImage && (
              // Tour images are remote URLs and no `next.config` image host is whitelisted on this branch.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tour.coverImage} alt={tour.title} className="h-56 w-full object-cover sm:h-72" />
            )}

            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden="true" />
                  {tour.destination}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-4" aria-hidden="true" />
                  {formatDuration(tour.durationDays)}
                </span>
                {tour.agency && <span>Tổ chức bởi {tour.agency.name}</span>}
              </div>

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{tour.title}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RatingStars value={tour.ratingAvg} count={tour.ratingCount} size="sm" />
                <span className="text-sm text-slate-500">
                  {tour.ratingCount > 0 ? `${tour.ratingAvg.toFixed(1)}/5 · ${tour.ratingCount} đánh giá` : 'Chưa có đánh giá'}
                </span>
              </div>

              <p className="mt-3 text-lg font-extrabold text-primary-container" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatVnd(tour.basePrice)} <span className="text-xs font-semibold text-slate-500">/ khách</span>
              </p>

              {(() => {
                const bookableDepartures = (tour.departures ?? []).filter(
                  (departure) => departure.isOpen && departure.remaining > 0 && new Date(departure.date).getTime() > Date.now(),
                );
                const departure = bookableDepartures.find((item) => item.id === selectedDepartureId) ?? bookableDepartures[0];
                const maxParticipants = Math.min(50, departure?.remaining ?? 1);

                if (bookableDepartures.length === 0) {
                  return <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">Tour hiện chưa có ngày khởi hành nào còn chỗ.</p>;
                }
                if (!isAuthenticated) {
                  return <Link href="/login" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary"><span className="material-symbols-outlined text-[19px]" aria-hidden="true">login</span>Đăng nhập để đặt tour</Link>;
                }
                if (role !== 'TRAVELER') return null;

                return (
                  <section className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/50 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-extrabold text-slate-900">Chọn ngày khởi hành</h2>
                      <span className="text-xs font-semibold text-teal-800">Còn {departure?.remaining ?? 0} chỗ</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end">
                      <label className="block text-xs font-bold text-slate-700">Ngày đi
                        <select value={departure?.id ?? ''} onChange={(event) => { setSelectedDepartureId(event.target.value); setParticipants(1); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20">
                          {bookableDepartures.map((item) => <option key={item.id} value={item.id}>{formatDepartureDate(item.date)} · {formatVnd(item.price)}</option>)}
                        </select>
                      </label>
                      <label className="block text-xs font-bold text-slate-700">Số khách
                        <input type="number" min={1} max={maxParticipants} value={participants} onChange={(event) => setParticipants(Math.max(1, Math.min(maxParticipants, Number(event.target.value) || 1)))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20" />
                      </label>
                      {departure && <button type="button" onClick={() => {
                        const query = new URLSearchParams({ tourId: tour.id, departureId: departure.id, participants: String(participants), direct: '1' });
                        router.push(`/traveler/bookings/new?${query.toString()}`);
                      }} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-container px-4 text-sm font-bold text-white transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-brand-teal/30">Đặt tour</button>}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">Bạn sẽ kiểm tra thông tin liên hệ, giá và ưu đãi trước khi xác nhận đặt chỗ.</p>
                  </section>
                );
              })()}

              <WishlistButton tourId={tour.id} className="mt-4" />

              {tour.description && (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{tour.description}</p>
              )}
            </div>
          </article>

          <TourReviewsSection
            tourId={tour.id}
            tourTitle={tour.title}
            ratingAvg={tour.ratingAvg}
            ratingCount={tour.ratingCount}
          />
        </>
      )}
    </>
  );
}
