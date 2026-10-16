'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ConfigProvider, Select } from 'antd';
import { Users, Wallet, ReceiptText, CalendarCheck, ArrowRight, RotateCw, Map, CalendarDays } from 'lucide-react';
import { useGetAgencyDashboardQuery, getTourApiMessage } from '@/features/tours/api/toursApi';
import { AgencyDenied, AgencyError, AgencyLoading, bookingStatusNames, dateTime, money, useAgencyPermission } from '@/features/agency/AgencyUi';
import { AgencyRevenueChart, rollingRevenueSeries } from '@/features/agency/components/AgencyRevenueChart';
import styles from '@/features/agency/components/AgencyDashboard.module.css';

function TourCover({ src, title }: { src?: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return <span className={styles.tourMark}>{src && !failed ? <img src={src} alt={`Ảnh tour ${title}`} width={48} height={48} loading="lazy" onError={() => setFailed(true)} className={styles.tourImage} /> : <Map size={22} aria-label="Tour chưa có ảnh đại diện" />}</span>;
}

const periodDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

export default function AgencyDashboardPage() {
  const [range, setRange] = useState<7 | 30 | '6m'>(30);
  const canView = useAgencyPermission('agency:dashboard');
  const canViewBookings = useAgencyPermission('agency:bookings-view');
  const canViewTours = useAgencyPermission('tour:update-own');
  const { data, isLoading, isFetching, error, refetch } = useGetAgencyDashboardQuery(undefined, { skip: !canView, refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true });
  if (!canView) return <AgencyDenied />;
  const series = data ? rollingRevenueSeries(data.generatedAt, data.last30Days) : [];
  const points = range === '6m' ? (data?.last6Months ?? []).map((point) => ({ ...point, date: `${point.month}-01` })) : range === 7 ? series.slice(-7) : series;
  const periodAvailable = range !== '6m' || !!data?.last6Months;
  const periodNet = points.reduce((total, point) => total + point.net, 0);
  const bookings = Object.values(data?.bookings ?? {}).reduce((sum, count) => sum + count, 0);
  const period = points.length && data ? `${periodDate(points[0].date)} – ${periodDate(data.generatedAt.slice(0, 10))}` : 'Chưa có dữ liệu';

  return <main className={styles.page}>
    <header className={styles.header}><div><h1>Tổng quan</h1><p className={styles.subtitle}>Khách hàng, đặt chỗ và doanh thu của bạn.</p></div><div className={styles.refresh}>
      {data && !error && <time dateTime={data.generatedAt}>Cập nhật {new Date(data.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time>}
      <button type="button" className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-primary hover:bg-teal-50 disabled:opacity-50" disabled={isFetching} onClick={() => void refetch()} aria-label="Làm mới" title="Làm mới"><RotateCw size={17} className={isFetching ? 'animate-spin motion-reduce:animate-none' : ''} /></button>
    </div></header>
    {isLoading ? <AgencyLoading label="Đang tải tổng quan…" /> : error ? <AgencyError message={getTourApiMessage(error, 'Không tải được tổng quan. Vui lòng thử lại.')} retry={() => void refetch()} /> : data && <>
      <div className={styles.bento} aria-busy={isFetching}>
        <section aria-label="Số liệu tổng quan" className={styles.financial}>{[
          { label: 'Khách hàng', value: data.customers === undefined ? '—' : data.customers.toLocaleString('vi-VN'), icon: Users, tone: 'light', note: data.customers === undefined ? 'Chưa có số liệu' : 'Khách đã đặt tour', help: 'Số khách khác nhau có đơn đã xác nhận hoặc hoàn thành, tính từ trước đến nay.' },
          { label: 'Lượt đặt', value: bookings.toLocaleString('vi-VN'), icon: ReceiptText, tone: 'medium', note: 'Tất cả đơn', help: 'Tổng số đơn đặt chỗ, gồm mọi trạng thái, tính từ trước đến nay.' },
          { label: 'Doanh thu', value: money(data.revenue.net), icon: Wallet, tone: 'strong', note: 'Sau hoa hồng', help: 'Doanh thu tích lũy của các đơn đã xác nhận hoặc hoàn thành, sau khi trừ hoa hồng.' },
        ].map(({ label, value, icon: Icon, tone, note, help }) => <article key={label} className={styles.metric} data-tone={tone} title={help}><span className={styles.metricIcon}><Icon size={21} aria-hidden="true" /></span><h2>{label}</h2><p className={styles.value}>{value}</p><p>{note}</p></article>)}</section>

        <section className={`${styles.panel} ${styles.chart} ${styles.revenuePanel}`} aria-label="Biểu đồ doanh thu">
          <div className={styles.panelHeader}><h2>Tổng doanh thu</h2><ConfigProvider theme={{ token: { colorPrimary: '#087e8b', colorText: '#143b40', borderRadius: 8, controlHeight: 40, fontFamily: 'inherit' } }}><Select aria-label="Khoảng thời gian doanh thu" value={range} style={{ width: 170, maxWidth: '100%' }} onChange={setRange} options={[{ value: 7, label: '7 ngày gần đây' }, { value: 30, label: '30 ngày gần đây' }, { value: '6m', label: '6 tháng gần đây' }]} /></ConfigProvider></div>
          <div className={styles.revenueContent}>
            <div className={styles.revenueSummary}><div><p className={styles.chartTotal}>{periodAvailable ? money(periodNet) : '—'}</p><p className={styles.note}>Sau hoa hồng</p></div><div className={styles.period}><CalendarDays size={16} aria-hidden="true" /><span>{period}</span></div></div>
            <div className={styles.chartCanvas}>{!periodAvailable ? <p role="alert" className={styles.note}>Chưa tải được số liệu. Hãy thử làm mới.</p> : points.every((point) => point.bookings === 0) ? <div className={styles.empty}><span className={styles.emptyMark}><CalendarCheck size={29} aria-hidden="true" /></span><h3>Chưa có doanh thu</h3><p>Số liệu sẽ xuất hiện khi có đơn đã xác nhận hoặc hoàn thành.</p>{canViewTours && <Link href="/agency/tours" className={styles.textLink}>Xem lịch tour <ArrowRight size={15} /></Link>}</div> : <AgencyRevenueChart points={points} monthly={range === '6m'} />}</div>
          </div>
          <p className={styles.note}>{range === '6m' ? 'Theo tháng; tháng hiện tại chưa kết thúc.' : range === 30 ? 'Theo tuần; ngày đầu có thể chưa trọn vẹn.' : 'Theo tuần; gồm 7 ngày gần nhất.'} Ngày thống kê theo giờ quốc tế.</p>
        </section>

        <section className={`${styles.panel} ${styles.topTours}`} aria-label="Tour bán chạy"><div className={styles.panelHeader}><h2>Tour bán chạy</h2>{canViewTours && <Link href="/agency/tours" className={styles.textLink}>Xem tất cả <ArrowRight size={14} /></Link>}</div><p className={styles.note}>Theo doanh thu tích lũy.</p>
          {data.topTours.length === 0 ? <div className={styles.empty}><span className={styles.emptyMark}><Map size={28} aria-hidden="true" /></span><h3>Chưa có tour</h3><p>Tour có doanh thu sẽ xuất hiện tại đây.</p></div> : <ol className={styles.tourList}>{data.topTours.map((tour) => <li key={tour.tourId} className={styles.tour}><TourCover key={tour.coverImage} src={tour.coverImage} title={tour.title} /><div>{canViewTours ? <Link href={`/agency/tours/${tour.tourId}`} className={styles.tourTitle}>{tour.title}</Link> : <span className={styles.tourTitle}>{tour.title}</span>}<small>{tour.bookings.toLocaleString('vi-VN')} lượt đặt</small></div><strong className={styles.tourValue}>{money(tour.net)}</strong></li>)}</ol>}
        </section>

        <section className={`${styles.panel} ${styles.chart}`}><div className={styles.panelHeader}><h2>Đơn đặt chỗ</h2>{canViewBookings && <Link href="/agency/bookings" className={styles.textLink}>Xem đơn <ArrowRight size={14} /></Link>}</div><dl className={styles.statuses}>{Object.entries(bookingStatusNames).map(([status, label]) => <div key={status}><dt>{label}</dt><dd>{(data.bookings[status] ?? 0).toLocaleString('vi-VN')}</dd></div>)}</dl></section>
        <section className={`${styles.panel} ${styles.topTours}`}><h2>Tour và phản hồi</h2><dl className={styles.tourStats}>{[['Tổng tour', data.tours.total], ['Đã duyệt', data.tours.byStatus.APPROVED ?? 0], ['Chờ duyệt', data.tours.byStatus.PENDING_REVIEW ?? 0], ['Bản nháp', data.tours.byStatus.DRAFT ?? 0], ['Chờ phản hồi', data.openComplaints]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{Number(value).toLocaleString('vi-VN')}</dd></div>)}</dl></section>
      </div>
      <p className={styles.footerNote}>Cập nhật: {dateTime(data.generatedAt)} · Số liệu có thể trễ 30 giây. Ba ô trên là số liệu tích lũy; bộ lọc chỉ thay đổi biểu đồ.</p>
    </>}
  </main>;
}
