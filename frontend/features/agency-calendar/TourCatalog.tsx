'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, GripVertical, Clock3, ArrowRight, ChevronLeft, ChevronRight, ImageOff, RotateCw } from 'lucide-react';
import { useGetAgencyToursQuery } from '@/features/tours/api/toursApi';
import type { CalendarTour } from './types';
import { readRememberedTime, tourColor } from './calendarTime';
import styles from './calendar.module.css';

export function TourPhoto({ src, title, className, iconSize = 20 }: { src?: string | null; title: string; className?: string; iconSize?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={className ? `${styles.photo} ${className}` : styles.photo}>{src && src !== failed ? <img src={src} alt={title} loading="lazy" decoding="async" onError={() => setFailed(src)} /> : <ImageOff size={iconSize} aria-label="Tour chưa có ảnh" />}</span>;
}
export function TourCatalog({ onPick, canDrag, agencyId }: { onPick: (tour: CalendarTour) => void; canDrag: boolean; agencyId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  const tours = useGetAgencyToursQuery({ page, limit: 12, ...(q ? { q } : {}) });
  useEffect(() => {
    if (!host.current || !canDrag) return;
    let disposed = false;
    let draggable: { destroy: () => void } | undefined;
    import('@fullcalendar/react/interaction').then(({ Draggable }) => {
      if (disposed || !host.current) return;
      draggable = new Draggable(host.current, {
        itemSelector: '[data-tour]', minDistance: 8, longPressDelay: 350,
        eventData: (element) => {
          const tour = JSON.parse(element.dataset.tour!) as CalendarTour;
          return { title: tour.title, duration: { days: tour.durationDays }, startTime: readRememberedTime(agencyId), create: false };
        },
      });
    });
    return () => { disposed = true; draggable?.destroy(); };
  }, [canDrag, agencyId]);
  return <div className={styles.catalog}>
    <div className={styles.catalogHeading}><h2>Tour của bạn</h2><span className={styles.count}>{tours.currentData?.meta.total ?? '—'}</span></div>
    <label className={styles.search}><Search size={17} aria-hidden="true" /><input type="search" aria-label="Tìm tour để xếp lịch" placeholder="Tìm tên tour…" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />{tours.isFetching && <RotateCw size={15} className={styles.spin} />}</label>
    <div ref={host} className={styles.tourList} aria-busy={tours.isFetching}>
      {tours.isLoading ? Array.from({ length: 4 }, (_, index) => <div key={index} className={styles.tourSkeleton} />) : tours.isError ? <div role="alert" className={styles.inlineError}>Không tải được tour.<button type="button" onClick={() => void tours.refetch()}>Thử lại</button></div> : !tours.currentData?.items.length ? <div className={styles.catalogEmpty}><Search size={28} /><h3>Không tìm thấy tour</h3></div> : tours.currentData.items.filter((tour) => tour.status !== 'ARCHIVED').map((tour) => {
        const data: CalendarTour = {
          id: tour.id,
          title: tour.title,
          durationDays: tour.durationDays,
          basePrice: tour.basePrice,
          maxGroupSize: tour.maxGroupSize,
          agePricing: tour.agePricing,
          coverImage: tour.coverImage || tour.images?.[0],
          status: tour.status,
        };
        const color = tourColor(tour.id);
        return <button key={tour.id} type="button" data-tour={JSON.stringify(data)} className={styles.tourCard} onClick={() => onPick(data)} aria-label={`Xếp lịch ${tour.title}`}>
          <TourPhoto src={data.coverImage} title={tour.title} />
          <span className={styles.tourBody}><span className={styles.tourName}>{tour.title}</span><span className={styles.tourFacts}><span><Clock3 size={12} />{tour.durationDays} ngày</span><span className={styles.colorDot} style={{ background: color.text }} /></span><strong>{new Intl.NumberFormat('vi-VN').format(tour.basePrice)} ₫</strong></span>
          {canDrag ? <GripVertical size={17} className={styles.grip} aria-hidden="true" /> : <ArrowRight size={16} className={styles.grip} aria-hidden="true" />}
        </button>;
      })}
    </div>
    {tours.currentData && tours.currentData.meta.totalPages > 1 && <nav className={styles.catalogPagination} aria-label="Trang danh sách tour"><button type="button" aria-label="Trang tour trước" disabled={page <= 1 || tours.isFetching} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><span>{page} / {tours.currentData.meta.totalPages}</span><button type="button" aria-label="Trang tour sau" disabled={page >= tours.currentData.meta.totalPages || tours.isFetching} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></nav>}
  </div>;
}
