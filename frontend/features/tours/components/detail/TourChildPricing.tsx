import { Baby } from 'lucide-react';
import { ageUnitPrice, type AgePricing } from '@travel-platform/constants';
import { formatVnd } from '@/features/review';
import styles from './tour-detail.module.css';
export function TourChildPricing({ content, pricing, unitPrice = 0 }: { content?: string; pricing?: AgePricing | null; unitPrice?: number }) {
  const child = ageUnitPrice(unitPrice, pricing, 'child');
  const infant = ageUnitPrice(unitPrice, pricing, 'infant');
  return <section className={styles.policyBlock}><h3><Baby size={20} /> Giá tour dành cho trẻ em</h3>
    <div className={styles.ageTable}><div><span>Người lớn · từ 13 tuổi trở lên</span><strong>{formatVnd(unitPrice)}</strong></div>{child !== null && <div><span>Trẻ em · độ tuổi 2 - 12</span><strong>{formatVnd(child)}</strong></div>}{infant !== null && <div><span>Em bé · dưới 2 tuổi</span><strong>{formatVnd(infant)}</strong></div>}</div>
    {content ? <p className={styles.prose}>{content}</p> : !pricing && <p className={styles.muted}>Chính sách giá trẻ em chưa được công bố. Vui lòng xác nhận với đơn vị tổ chức trước khi đặt chỗ.</p>}
  </section>;
}
