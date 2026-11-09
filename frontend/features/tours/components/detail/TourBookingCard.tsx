'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { calculateGuestPrice, guestTotal, type GuestCounts } from '@travel-platform/constants';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectRole } from '@/features/auth';
import { formatVnd } from '@/features/review';
import type { TourReviewContext } from '@/features/review/types';
import { TourGuestSelector } from './TourGuestSelector';
import { readSearchGuests } from '../../utils/searchContext';
import styles from './tour-detail.module.css';
export function TourBookingCard({ tour }: { tour: TourReviewContext }) {
  const router = useRouter();
  const params = useSearchParams();
  const authenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);
  const [selected, setSelected] = useState('');
  const [guests, setGuests] = useState<GuestCounts>(() => readSearchGuests(params));
  const departures = (tour.departures ?? []).filter(item => item.isOpen && item.remaining > 0 && new Date(item.date).getTime() > Date.now());
  const departure = departures.find(item => item.id === selected)
    ?? departures.find(item => {
      const date = item.date.slice(0, 10);
      return (!params.get('departureFrom') || date >= params.get('departureFrom')!)
        && (!params.get('departureTo') || date <= params.get('departureTo')!);
    }) ?? departures[0];
  const price = departure?.price ?? tour.basePrice;
  const count = guestTotal(guests);
  const max = Math.min(50, departure?.remaining ?? 0);
  const valid = !!departure && count <= max;
  let total = 0;
  let pricingError = '';
  try { total = calculateGuestPrice(price, count, guests, tour.agePricing).subtotal; }
  catch { pricingError = 'Tour chưa công bố giá trẻ em/em bé cho lựa chọn này. Vui lòng điều chỉnh hành khách hoặc chọn tour có chính sách giá phù hợp.'; }
  const action = () => {
    if (!departure || !valid || !total) return;
    const bookingParams = new URLSearchParams({ tourId: tour.id, departureId: departure.id, participants: String(count), adults: String(guests.adults), children: String(guests.children), infants: String(guests.infants) });
    const bookingHref = `/traveler/bookings/new?${bookingParams}`;
    if (!authenticated) { router.push(`/login?next=${encodeURIComponent(bookingHref)}`); return; }
    if (role === 'TRAVELER') router.push(bookingHref);
  };
  return <aside className={styles.booking} aria-label="Đặt tour"><div className={styles.priceHeader}><p>Giá từ</p><strong>{formatVnd(price)}</strong><small>/ khách</small></div>
    <div className={styles.bookingBody}><h2 className={styles.bookingLabel}>NGÀY KHỞI HÀNH</h2>{departures.length ? <div className={styles.departureGrid}>{departures.map(item => <button type="button" key={item.id} aria-pressed={departure?.id === item.id} aria-label={`Khởi hành ${new Date(item.date).toLocaleDateString('vi-VN')}`} onClick={() => setSelected(item.id)}>{new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}<small>{formatVnd(item.price)}</small></button>)}</div> : <p className={styles.muted}>Tour hiện chưa có ngày khởi hành còn chỗ.</p>}
      {departure && <>
        <h2 className={styles.bookingLabel}>SỐ NGƯỜI · CÒN {departure.remaining} CHỖ</h2>
        <TourGuestSelector value={guests} onChange={setGuests} max={max} unitPrice={price} pricing={tour.agePricing} />
        {!pricingError && <div className={styles.totals}>
          <div><span>Người lớn × {guests.adults}</span><span>{formatVnd(price * guests.adults)}</span></div>
          {guests.children > 0 && <div><span>Trẻ em × {guests.children}</span><span>{formatVnd(Math.round(price * (tour.agePricing?.childPercent ?? 100) / 100) * guests.children)}</span></div>}
          {guests.infants > 0 && <div><span>Em bé × {guests.infants}</span><span>{formatVnd(Math.round(price * (tour.agePricing?.infantPercent ?? 100) / 100) * guests.infants)}</span></div>}
          <div><span>Tổng cộng</span><strong>{formatVnd(total)}</strong></div>
        </div>}
      </>}
      {pricingError && <p role="alert" className={styles.muted}>{pricingError}</p>}
      {departure && count > max && <p role="alert">Chỉ còn {max} chỗ. Vui lòng điều chỉnh số khách hoặc chọn ngày khác.</p>}
      {(!authenticated || role === 'TRAVELER') && <button type="button" className={styles.primaryButton} disabled={!valid || !total} onClick={action}>{authenticated ? 'Yêu cầu đặt tour' : 'Đăng nhập để đặt tour'}<ArrowRight size={17} /></button>}
      <p className={styles.footnote}>Giá và ưu đãi sẽ được kiểm tra lại trước khi xác nhận đặt chỗ. Mỗi hành khách, kể cả em bé, được tính một chỗ.</p>
    </div>
  </aside>;
}
