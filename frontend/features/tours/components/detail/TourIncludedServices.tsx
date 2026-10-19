import { CheckCircle2 } from 'lucide-react';
import styles from './tour-detail.module.css';
export function TourIncludedServices({ items }: { items: string[] }) {
  return <section className={styles.policyBlock}><h3><CheckCircle2 size={20} /> Giá tour bao gồm</h3>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className={styles.muted}>Đơn vị tổ chức chưa công bố các dịch vụ bao gồm.</p>}</section>;
}
