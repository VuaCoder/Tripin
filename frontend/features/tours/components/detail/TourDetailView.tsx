'use client';
import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { ChevronRight, Printer, MapPin, Clock3, Building2, Sparkles } from 'lucide-react';
import { WishlistButton } from '@/features/wishlist';
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
import styles from './tour-detail.module.css';
export function TourDetailView({ tour }: { tour: TourReviewContext }) {
  const [tab, setTab] = useState('lich-trinh');
  const navigateSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.replaceState(null, '', `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  const images = tour.images?.length ? tour.images : tour.coverImage ? [tour.coverImage] : [];
  return <div className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Đường dẫn"><Link href="/tours">Khám phá tour</Link><ChevronRight size={14} /><span>{tour.destination}</span></nav>
    <div className={styles.titleRow}><div><h1>{tour.title}</h1><div className={styles.ratings}><RatingStars value={tour.ratingAvg} count={tour.ratingCount} size="sm" /><a href="#danh-gia" onClick={event => navigateSection(event, 'danh-gia')}>{tour.ratingCount ? `${tour.ratingAvg.toFixed(1)}/5 · ${tour.ratingCount} đánh giá` : 'Chưa có đánh giá'}</a></div></div><div className={styles.titleActions}><WishlistButton tourId={tour.id} /><button type="button" className={styles.outlineButton} onClick={() => window.print()}><Printer size={17} />In chương trình</button></div></div>
    <TourGallery images={images} title={tour.title} />
    <div className={styles.bodyGrid}><div className={styles.mainContent}>
      <div className={styles.facts}><span><MapPin size={19} /><strong>Điểm đến:</strong> {tour.destination}</span><span><Clock3 size={19} />{tour.durationDays} ngày</span>{tour.agency && <span><Building2 size={19} /><Link href={`/agencies/${tour.agency.id}`} className="underline underline-offset-4">{tour.agency.name}</Link></span>}{tour.guide && <span><Link href={`/tour-guides/${tour.guide.id}`} className="underline underline-offset-4">Hướng dẫn viên: {tour.guide.fullName}</Link></span>}</div>
      {(tour.summary || tour.description) && <section className={styles.overview}><h2><Sparkles size={21} />Hành trình có gì hay?</h2><p>{tour.summary || tour.description}</p></section>}
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
        {tab === 'chinh-sach-gia' && <section id="chinh-sach-gia" className={styles.section} aria-labelledby="price-policy-heading"><h2 id="price-policy-heading">Chính sách giá</h2><TourIncludedServices items={tour.inclusions ?? []} /><TourExcludedServices items={tour.exclusions ?? []} /><TourChildPricing content={tour.childPricingPolicy} pricing={tour.agePricing} /></section>}
        {tab === 'huong-dan' && <section id="huong-dan" className={styles.section} aria-labelledby="travel-guidance-heading"><h2 id="travel-guidance-heading">Hướng dẫn trước chuyến đi</h2><TourTravelNotes content={tour.travelNotes} /><TourCancellationPolicy content={tour.cancellationPolicy} /><TourRequiredDocuments content={tour.requiredDocuments} /></section>}
      </div>
    </div><TourBookingCard key={tour.id} tour={tour} /></div>
    <div id="danh-gia" className={styles.section}><TourReviewsSection tourId={tour.id} tourTitle={tour.title} ratingAvg={tour.ratingAvg} ratingCount={tour.ratingCount} /></div>
  </div>;
}
