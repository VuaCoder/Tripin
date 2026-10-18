import { CalendarX2 } from 'lucide-react';
import styles from './tour-detail.module.css';
export function TourCancellationPolicy({ content }: { content?: string }) {
  return <section className={styles.policyBlock}><h3><CalendarX2 size={20} /> Điều kiện đổi, hủy tour</h3><p className={content ? styles.prose : styles.muted}>{content || 'Điều kiện đổi, hủy riêng của tour đang được cập nhật. Vui lòng xác nhận với đơn vị tổ chức trước khi đặt chỗ.'}</p><p className={styles.footnote}>Thao tác hủy và trạng thái hoàn tiền được xác nhận tại trang quản lý chuyến đi của bạn.</p></section>;
}
