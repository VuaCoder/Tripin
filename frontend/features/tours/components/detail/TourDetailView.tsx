'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type GuestCounts } from '@travel-platform/constants';
import { GuestLoginPromptModal, BackButton } from '@/components/shared';
import { ChevronRight, Printer, MapPin, Clock3, Building2, Check, User } from 'lucide-react';
import { WishlistButton } from '@/features/wishlist';
import { ReportButton } from '@/features/report';
import { StartConversationButton } from '@/features/chat/StartConversationButton';
import { TourReviewsSection } from '@/features/review';
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
import { SimilarToursSection } from './SimilarToursSection';
import { saveRecentlyViewedTour } from '../../utils';
import { readSearchGuests } from '../../utils/searchContext';
import styles from './tour-detail.module.css';
export function TourDetailView({ tour }: { tour: TourReviewContext }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState('lich-trinh');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [failedAgencyAvatar, setFailedAgencyAvatar] = useState<string | null>(null);
  const [printSelection, setPrintSelection] = useState<{ departureId?: string; guests: GuestCounts }>(() => ({
    departureId: searchParams?.get('departureId') ?? undefined,
    guests: readSearchGuests(searchParams),
  }));
  const handleSelectionChange = useCallback((selection: { departureId?: string; guests: GuestCounts }) => {
    setPrintSelection(prev => {
      if (
        prev.departureId === selection.departureId &&
        prev.guests.adults === selection.guests.adults &&
        prev.guests.children === selection.guests.children &&
        prev.guests.infants === selection.guests.infants
      ) {
        return prev;
      }
      return selection;
    });
  }, []);
  const printQuery = new URLSearchParams();
  if (printSelection.departureId) printQuery.set('departureId', printSelection.departureId);
  const selectedDeparture = tour.departures?.find((departure) => departure.id === printSelection.departureId);
  if (selectedDeparture) printQuery.set('departureDate', selectedDeparture.date.slice(0, 10));
  printQuery.set('adults', String(printSelection.guests.adults));
  printQuery.set('children', String(printSelection.guests.children));
  printQuery.set('infants', String(printSelection.guests.infants));
  const printHref = `/tours/${tour.id}/print?${printQuery.toString()}`;
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
  const images = tour.images?.length ? tour.images : tour.coverImage ? [tour.coverImage] : [];
  return <div className={styles.page}>
    <div className={styles.titleRow}>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <BackButton fallbackUrl="/tours" className="shrink-0" />
        <h1 className="min-w-0">{tour.title}</h1>
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
          href={printHref}
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
      <div className="mb-4 flex items-center justify-between text-sm text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={16} className="text-teal-700 shrink-0" />
          <span><strong className="font-semibold text-slate-900">Điểm đến:</strong> {tour.destination}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
          <Clock3 size={16} className="text-teal-700 shrink-0" />
          <span>{tour.durationDays} ngày</span>
        </span>
      </div>
      {(tour.agency || tour.guide) && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-teal-100 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0">
              <div className="flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-teal-100 bg-slate-50 p-0.5 text-teal-600">
                {tour.agency?.avatarUrl && tour.agency.avatarUrl !== failedAgencyAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tour.agency.avatarUrl}
                    alt={tour.agency?.name ?? 'Agency'}
                    className="size-full rounded-full object-cover"
                    onError={() => setFailedAgencyAvatar(tour.agency!.avatarUrl!)}
                  />
                ) : (
                  <Building2 className="size-5" aria-hidden="true" />
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-teal-600 text-white ring-2 ring-white">
                <Check size={10} strokeWidth={3.5} />
              </span>
            </div>
            <div className="min-w-0">
              {tour.agency && (
                <p className="text-base font-bold leading-snug text-slate-900">
                  <Link href={`/agencies/${tour.agency.id}`} className="hover:text-teal-700 transition-colors">
                    {tour.agency.name}
                  </Link>
                </p>
              )}
              {tour.guide ? (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                  <User size={14} className="text-teal-600 shrink-0" />
                  <Link href={`/tour-guides/${tour.guide.id}`} className="hover:underline">
                    Hướng dẫn viên: <span className="font-medium text-slate-800">{tour.guide.fullName}</span>
                  </Link>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-medium text-teal-700">Nhà cung cấp</span> · Đối tác tổ chức
                </div>
              )}
            </div>
          </div>
          <StartConversationButton
            participantId={tour.guide?.id || tour.agency?.id || ''}
            tourId={tour.id}
            label="Trò chuyện"
            iconOnly
            onGuestClick={() => setShowLoginModal(true)}
            className="grid size-10 place-items-center rounded-xl border border-teal-200 bg-teal-50/60 hover:bg-teal-100/70 text-teal-800 shadow-2xs transition-colors shrink-0 cursor-pointer"
          />
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
    </div><TourBookingCard key={tour.id} tour={tour} onSelectionChange={handleSelectionChange} /></div>
    <div id="danh-gia" className={styles.section}><TourReviewsSection tourId={tour.id} tourTitle={tour.title} ratingAvg={tour.ratingAvg} ratingCount={tour.ratingCount} /></div>
    <SimilarToursSection
      currentTourId={tour.id}
      destination={tour.destination}
      categoryId={tour.categories?.[0]?.id || tour.categoryIds?.[0]}
    />
    <GuestLoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} redirectUrl={`/tours/${tour.id}`} tourTitle={tour.title} />
  </div>;
}
