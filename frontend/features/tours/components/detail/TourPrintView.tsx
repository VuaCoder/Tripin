'use client';

import Link from 'next/link';
import type { TourReviewContext } from '@/features/review/types';
import { formatVnd, formatDepartureDate } from '../../utils';
import { TourIncludedServices } from './TourIncludedServices';
import { TourExcludedServices } from './TourExcludedServices';
import { TourChildPricing } from './TourChildPricing';
import { TourCancellationPolicy } from './TourCancellationPolicy';
import { TourRequiredDocuments } from './TourRequiredDocuments';
import { TourTravelNotes } from './TourTravelNotes';
import styles from './tour-print.module.css';

export function TourPrintView({ tour }: { tour: TourReviewContext }) {
  const departures = [...(tour.departures ?? [])].filter(d => d.isOpen && d.remaining > 0 && new Date(d.date).getTime() >= new Date().setHours(0, 0, 0, 0)).sort((a, b) => a.date.localeCompare(b.date));
  return <main className={styles.page}>
    <nav className={styles.toolbar} aria-label="Thao tác bản in">
      <Link href={`/tours/${tour.id}`}>← Chi tiết tour</Link>
      <button type="button" onClick={() => window.print()}>In / Lưu PDF</button>
    </nav>
    <article className={styles.document}>
      <header className={styles.header}><span className={styles.brand}>Tripri</span><p>CHƯƠNG TRÌNH DU LỊCH</p><h1>{tour.title}</h1></header>
      <dl className={styles.facts}>
        <div><dt>Mã tour</dt><dd>{tour.id}</dd></div>
        <div><dt>Điểm đến</dt><dd>{tour.destination}</dd></div>
        <div><dt>Thời gian</dt><dd>{tour.durationDays} ngày</dd></div>
        <div><dt>Giá từ / người lớn</dt><dd>{formatVnd(tour.basePrice)}</dd></div>
        {tour.agency && <div><dt>Đơn vị tổ chức</dt><dd>{tour.agency.name}</dd></div>}
        {tour.guide && <div><dt>Hướng dẫn viên</dt><dd>{tour.guide.fullName}</dd></div>}
      </dl>
      {(tour.summary || tour.description) && <section><h2>Giới thiệu tour</h2>{tour.summary && <p>{tour.summary}</p>}{tour.description && tour.description !== tour.summary && <p>{tour.description}</p>}</section>}
      <section><h2>Lịch trình chi tiết</h2>{tour.itinerary?.length ? [...tour.itinerary].sort((a, b) => a.day - b.day).map(day => <div key={day.day} className={styles.day}><h3>Ngày {day.day}{day.toDay && day.toDay > day.day ? ` – ${day.toDay}` : ''}: {day.title}</h3>{day.description && <p>{day.description}</p>}{!!day.activities?.length && <ul>{day.activities.map((activity, index) => <li key={index}>{activity}</li>)}</ul>}</div>) : <p>Đơn vị tổ chức đang cập nhật lịch trình chi tiết.</p>}</section>
      <section><h2>Lịch khởi hành</h2>{departures.length ? <table><thead><tr><th>Ngày khởi hành</th><th>Giá người lớn</th><th>Chỗ còn lại</th></tr></thead><tbody>{departures.map(d => <tr key={d.id}><td>{formatDepartureDate(d.date)}</td><td>{formatVnd(d.price)}</td><td>{d.remaining}</td></tr>)}</tbody></table> : <p>Vui lòng liên hệ đơn vị tổ chức để xác nhận lịch khởi hành.</p>}</section>
      <section><h2>Giá tour và dịch vụ</h2><TourIncludedServices items={tour.inclusions ?? []} /><TourExcludedServices items={tour.exclusions ?? []} /><TourChildPricing unitPrice={tour.basePrice} content={tour.childPricingPolicy} pricing={tour.agePricing} /></section>
      <section><h2>Hướng dẫn và điều kiện</h2><TourTravelNotes content={tour.travelNotes} /><TourCancellationPolicy content={tour.cancellationPolicy} /><TourRequiredDocuments content={tour.requiredDocuments} /></section>
      <footer className={styles.footer}>Giá và chỗ trống có thể thay đổi. Vui lòng xác nhận với đơn vị tổ chức trước khi đặt tour.</footer>
    </article>
  </main>;
}
