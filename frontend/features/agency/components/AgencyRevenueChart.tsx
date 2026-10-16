'use client';
import type { AgencyDashboard } from '../types';
import { money } from '../AgencyUi';
import styles from './AgencyDashboard.module.css';

type Point = AgencyDashboard['last30Days'][number];
export function rollingRevenueSeries(generatedAt: string, points: Point[]): Point[] {
  const date = new Date(generatedAt);
  const byDate = new Map(points.map((point) => [point.date, point]));
  return Array.from({ length: 31 }, (_, index) => {
    const key = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 30 + index)).toISOString().slice(0, 10);
    return byDate.get(key) ?? { date: key, bookings: 0, net: 0 };
  });
}

export function weeklyRevenueBuckets(points: Point[]) {
  const buckets: { week: string; from: string; to: string; net: number; bookings: number }[] = [];
  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const week = date.toISOString().slice(0, 10);
    let bucket = buckets[buckets.length - 1];
    if (!bucket || bucket.week !== week) { bucket = { week, from: point.date, to: point.date, net: 0, bookings: 0 }; buckets.push(bucket); }
    bucket.to = point.date;
    bucket.net += point.net;
    bucket.bookings += point.bookings;
  }
  return buckets;
}

const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const axisMoney = (value: number) => {
  const [unit, label] = value >= 1e9 ? [1e9, 'tỷ'] : value >= 1e6 ? [1e6, 'tr'] : value >= 1e3 ? [1e3, 'nghìn'] : [1, ''];
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / Number(unit))} ${label}`.trim();
};

export function AgencyRevenueChart({ points, monthly = false }: { points: Point[]; monthly?: boolean }) {
  const buckets = monthly ? points.map((point) => ({ week: point.date, from: point.date, to: point.date, net: point.net, bookings: point.bookings })) : weeklyRevenueBuckets(points);
  const periodLabel = (date: string) => monthly ? `T${Number(date.slice(5, 7))}/${date.slice(2, 4)}` : shortDate(date);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.net));
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const ceiling = Math.ceil(max / magnitude) * magnitude;
  return <>
    <div role="img" aria-label={`Biểu đồ doanh thu thực nhận tổng hợp theo ${monthly ? 'tháng' : 'tuần'}; bảng chi tiết bên dưới`} className={styles.revenuePlot}>
      <div className={styles.plotAxis} aria-hidden="true">{[0, 1, 2, 3, 4].map((tick) => <span key={tick} style={{ bottom: `${tick * 25}%` }}>{axisMoney(ceiling * tick / 4)}</span>)}</div>
      <div className={styles.plotBody} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((tick) => <span key={tick} className={styles.gridLine} style={{ bottom: `${tick * 25}%`, borderTopStyle: tick ? 'dashed' : 'solid' }} />)}
        <div className={styles.bars}>{buckets.map((bucket) => <div key={bucket.week} className={styles.barSlot}>
          <span className={styles.bar} style={{ height: `${Math.max(0, bucket.net) / ceiling * 100}%` }} title={`${periodLabel(bucket.from)}${monthly ? '' : `–${shortDate(bucket.to)}`}: ${money(bucket.net)}, ${bucket.bookings} lượt đặt`} />
          <span className={styles.barDate}>{periodLabel(bucket.from)}</span>
        </div>)}</div>
      </div>
    </div>
    <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-primary">Xem số liệu</summary><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th scope="col" className="py-2">{monthly ? 'Tháng' : 'Ngày'}</th><th scope="col">Lượt đặt</th><th scope="col">Thực nhận</th></tr></thead><tbody>{points.map((point) => <tr key={point.date} className="border-t border-slate-100"><td className="py-2">{monthly ? point.date.slice(0, 7) : point.date}</td><td>{point.bookings}</td><td className="tabular-nums">{money(point.net)}</td></tr>)}</tbody></table></div></details>
  </>;
}
