'use client';
import { useState, useEffect, type MouseEvent } from 'react';
import Link from 'next/link';
import { GuestLoginPromptModal } from '@/components/shared';
import { ChevronRight, Printer, MapPin, Clock3, Building2 } from 'lucide-react';
import { WishlistButton } from '@/features/wishlist';
import { ReportButton } from '@/features/report';
import { RatingStars, TourReviewsSection } from '@/features/review';
import type { TourReviewContext } from '@/features/review/types';
import { TourGallery } from './TourGallery';
import { TourItinerary } from './TourItinerary';
import { TourBookingCard } from './TourBookingCard';
import { TourIncludedServices } from './TourIncludedServices';
import { TourExcludedServices } from './TourExcludedServices';
import { TourChildPricing } from './TourChildPricing';
import { TourCancellationPolicy } from './TourCancellationPolicy';
import { TourRequiredDocuments } from './TourRequiredDocuments';
import { TourTravelNotes } from './TourTravelNotes';
import { saveRecentlyViewedTour } from '../../utils';
import styles from './tour-detail.module.css';
export function TourDetailView({ tour }: { tour: TourReviewContext }) {
  const [tab, setTab] = useState('lich-trinh');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [failedAgencyAvatar, setFailedAgencyAvatar] = useState<string | null>(null);
  useEffect(() => {
    if (tour?.id) {
      saveRecentlyViewedTour({
        id: tour.id,
        title: tour.title,
        destination: tour.destination,
        durationDays: tour.durationDays,
        basePrice: tour.basePrice,
        coverImage: tour.images?.[0] || tour.coverImage,
        categoryIds: tour.categories?.map((c) => c.id) || tour.categoryIds || [],
        ratingAvg: tour.ratingAvg,
        ratingCount: tour.ratingCount,
      });
    }
  }, [tour]);
  const navigateSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.replaceState(null, '', `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  const images = tour.images?.length ? tour.images : tour.coverImage ? [tour.coverImage] : [];
  return <div className={styles.page}>
    <div className={styles.titleRow}>
      <div>
        <h1>{tour.title}</h1>
        <div className={styles.ratings}>
          <RatingStars value={tour.ratingAvg} count={tour.ratingCount} size="sm" />
          <a href="#danh-gia" onClick={event => navigateSection(event, 'danh-gia')}>
            {tour.ratingCount ? `${tour.ratingAvg.toFixed(1)}/5 · ${tour.ratingCount} đánh giá` : 'Chưa có đánh giá'}
          </a>
        </div>
      </div>
      <div className={styles.titleActions}>
        <WishlistButton
          tourId={tour.id}
          tourTitle={tour.title}
          tourCoverImage={tour.coverImage || (images.length > 0 ? images[0] : undefined)}
          variant="circle"
          onGuestClick={() => setShowLoginModal(true)}
        />
        <ReportButton targetType="TOUR" targetId={tour.id} targetLabel={tour.title} iconOnly />
        <Link
          href={`/tours/${tour.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.iconActionButton}
          aria-label="In chương trình"
          title="In chương trình"
        >
          <Printer size={18} className="text-slate-500" />
        </Link>
      </div>
    </div>
    <TourGallery images={images} title={tour.title} />
    <div className={styles.bodyGrid}><div className={styles.mainContent}>
      <div className={styles.facts}><span><MapPin size={19} /><strong>Điểm đến:</strong> {tour.destination}</span><span><Clock3 size={19} />{tour.durationDays} ngày</span>{tour.agency && <span><Building2 size={19} /><Link href={`/agencies/${tour.agency.id}`} className="underline underline-offset-4">{tour.agency.name}</Link></span>}{tour.guide && <span><Link href={`/tour-guides/${tour.guide.id}`} className="underline underline-offset-4">Hướng dẫn viên: {tour.guide.fullName}</Link></span>}</div>
      {tour.agency && (
        <div className="my-4 flex flex-col gap-3 bg-white py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0">
              <div className="flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-teal-100 bg-slate-50 p-0.5 text-teal-600">
              {tour.agency.avatarUrl && tour.agency.avatarUrl !== failedAgencyAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tour.agency.avatarUrl}
                  alt={tour.agency.name}
                  className="size-full rounded-full object-cover"
                  onError={() => setFailedAgencyAvatar(tour.agency!.avatarUrl!)}
                />
              ) : <Building2 className="size-5" aria-hidden="true" />}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug text-slate-900 sm:text-base">{tour.agency.name}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span><span className="font-medium text-teal-700">Nhà cung cấp</span> · Đối tác tổ chức</span>
              </div>
            </div>
          </div>
          <Link
            href={`/agencies/${tour.agency.id}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition-colors shrink-0"
          >
            <span>Trang nhà cung cấp & Voucher</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      )}
      <div className={styles.tabs} role="tablist" aria-label="Nội dung tour">{[['lich-trinh', 'Lịch trình'], ['chinh-sach-gia', 'Chính sách giá'], ['huong-dan', 'Hướng dẫn']].map(([id, label], index, tabs) => <button type="button" role="tab" key={id} id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => {
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        setTab(tabs[next][0]);
        document.getElementById(`tab-${tabs[next][0]}`)?.focus();
      }}>{label}</button>)}</div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {tab === 'lich-trinh' && <TourItinerary days={tour.itinerary ?? []} />}
        {tab === 'chinh-sach-gia' && <section id="chinh-sach-gia" className={styles.section} aria-labelledby="price-policy-heading"><h2 id="price-policy-heading">Chính sách giá</h2><TourIncludedServices items={tour.inclusions ?? []} /><TourExcludedServices items={tour.exclusions ?? []} /><TourChildPricing unitPrice={tour.basePrice} content={tour.childPricingPolicy} pricing={tour.agePricing} /></section>}
        {tab === 'huong-dan' && <section id="huong-dan" className={styles.section} aria-labelledby="travel-guidance-heading"><h2 id="travel-guidance-heading">Hướng dẫn trước chuyến đi</h2><TourTravelNotes content={tour.travelNotes} /><TourCancellationPolicy content={tour.cancellationPolicy} /><TourRequiredDocuments content={tour.requiredDocuments} /></section>}
      </div>
    </div><TourBookingCard key={tour.id} tour={tour} /></div>
    <div id="danh-gia" className={styles.section}><TourReviewsSection tourId={tour.id} tourTitle={tour.title} ratingAvg={tour.ratingAvg} ratingCount={tour.ratingCount} /></div>
    <GuestLoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} redirectUrl={`/tours/${tour.id}`} tourTitle={tour.title} />
  </div>;
}
