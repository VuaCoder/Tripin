import { ContactRound } from 'lucide-react';
import styles from './tour-detail.module.css';
export function TourRequiredDocuments({ content }: { content?: string }) {
  return <section className={styles.policyBlock}><h3><ContactRound size={20} /> Giấy tờ tùy thân</h3><p className={content ? styles.prose : styles.muted}>{content || 'Yêu cầu giấy tờ của tour đang được cập nhật. Hãy xác nhận loại giấy tờ cần mang cho từng hành khách với đơn vị tổ chức.'}</p></section>;
}
