import { Baby } from 'lucide-react';
import type { AgePricing } from '@travel-platform/constants';
import styles from './tour-detail.module.css';
export function TourChildPricing({ content, pricing }: { content?: string; pricing?: AgePricing | null }) {
  return <section className={styles.policyBlock}><h3><Baby size={20} /> Giá tour dành cho trẻ em</h3>
    {pricing && <div className={styles.ageTable}><div><span>Người lớn · từ {pricing.adultMinAge} tuổi</span><strong>100% giá tour</strong></div><div><span>Trẻ em · từ {pricing.childMinAge} đến dưới {pricing.adultMinAge} tuổi</span><strong>{pricing.childPercent}% giá tour</strong></div><div><span>Em bé · dưới {pricing.childMinAge} tuổi</span><strong>{pricing.infantPercent}% giá tour</strong></div></div>}
    {content ? <p className={styles.prose}>{content}</p> : !pricing && <p className={styles.muted}>Chính sách giá trẻ em chưa được công bố. Vui lòng xác nhận với đơn vị tổ chức trước khi đặt chỗ.</p>}
  </section>;
}
