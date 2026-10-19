import { ChevronDown, Check } from 'lucide-react';
import type { TourItineraryDay } from '../../types';
import styles from './tour-detail.module.css';
export function TourItinerary({ days }: { days: TourItineraryDay[] }) {
  return <section id="lich-trinh" className={styles.section} aria-labelledby="itinerary-heading"><h2 id="itinerary-heading">Lịch trình chi tiết</h2>
    {!days.length ? <p className={styles.muted}>Đơn vị tổ chức đang cập nhật lịch trình chi tiết.</p> : <div className={styles.itinerary}>{[...days].sort((a, b) => a.day - b.day).map((day, index) => <details key={day.day} open={index === 0}>
      <summary><span className={styles.dayBadge}>Ngày {String(day.day).padStart(2, '0')}</span><span>{day.title}</span><ChevronDown size={19} /></summary>
      <div className={styles.dayContent}>{day.description && <p className={styles.prose}>{day.description}</p>}{day.activities?.length > 0 && <ul className={styles.activityList}>{day.activities.map((activity, i) => <li key={i}><Check size={16} /><span>{activity}</span></li>)}</ul>}{!day.description && !day.activities?.length && <p className={styles.muted}>Thông tin hoạt động trong ngày đang được cập nhật.</p>}</div>
    </details>)}</div>}
  </section>;
}
