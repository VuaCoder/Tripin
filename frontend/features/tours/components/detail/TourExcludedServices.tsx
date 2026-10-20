import { CircleMinus } from 'lucide-react';
import styles from './tour-detail.module.css';
export function TourExcludedServices({ items }: { items: string[] }) {
  return <section className={styles.policyBlock}><h3><CircleMinus size={20} /> Giá tour không bao gồm</h3>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className={styles.muted}>Đơn vị tổ chức chưa công bố các khoản không bao gồm.</p>}</section>;
}
