import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Compass, House, MapPin } from 'lucide-react';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <section className={styles.page} aria-labelledby="not-found-heading">
      <div className={styles.content}>
        <p className={styles.code} aria-label="Lỗi 404">404<span aria-hidden="true">.</span></p>
        <h1 id="not-found-heading">Hành trình này chưa có trên bản đồ.</h1>
        <p className={styles.description}>Trang bạn đang tìm có thể đã được di chuyển hoặc đường dẫn chưa chính xác. Đừng lo, vẫn còn nhiều điểm đến đang chờ bạn cùng Tripri.</p>
        <div className={styles.actions}>
          <Link href="/tours" className={styles.primary}>Khám phá tour <ArrowRight size={18} aria-hidden="true" /></Link>
          <Link href="/home" className={styles.secondary}><House size={17} aria-hidden="true" />Về trang chủ</Link>
        </div>
        <p className={styles.note}><Compass size={17} aria-hidden="true" />Đổi hướng một chút, tiếp tục chuyến đi.</p>
      </div>

      <div className={styles.visual}>
        <svg className={styles.route} viewBox="0 0 500 500" fill="none" aria-hidden="true">
          <path d="M25 365C-12 240 170 280 146 173S309 25 410 93s-78 138 3 220 89 42 66 132" stroke="currentColor" strokeWidth="2" strokeDasharray="5 9" strokeLinecap="round" />
          <circle cx="25" cy="365" r="7" fill="currentColor" /><circle cx="479" cy="445" r="7" fill="currentColor" />
        </svg>
        <figure className={styles.postcard}>
          <div className={styles.photo}>
            <Image src="/images/hero-vietnam.png" alt="Thuyền trên mặt nước xanh giữa những dãy núi đá vôi Việt Nam" fill priority sizes="(max-width: 700px) 85vw, 420px" />
            <span className={styles.pin} aria-hidden="true"><MapPin size={24} /></span>
          </div>
          <figcaption><span>Hẹn ở một hành trình khác.</span><span className={styles.brand}>tripri<Compass size={17} aria-hidden="true" /></span></figcaption>
        </figure>
        <div className={styles.destination}><MapPin size={16} aria-hidden="true" /><span>Điểm đến tiếp theo: một trải nghiệm mới</span></div>
      </div>
    </section>
  );
}
