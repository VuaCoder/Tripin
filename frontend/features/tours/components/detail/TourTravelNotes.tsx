import { Backpack } from 'lucide-react';
import styles from './tour-detail.module.css';
export function TourTravelNotes({ content }: { content?: string }) {
  return <section className={styles.policyBlock}><h3><Backpack size={20} /> Lưu ý cho chuyến đi</h3><p className={content ? styles.prose : styles.muted}>{content || 'Các lưu ý riêng cho hành trình đang được đơn vị tổ chức cập nhật.'}</p></section>;
}
