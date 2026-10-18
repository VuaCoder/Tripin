'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { calculateGuestPrice, guestTotal, type GuestCounts } from '@travel-platform/constants';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectRole } from '@/features/auth';
import { StartConversationButton } from '@/features/chat/StartConversationButton';
import { formatVnd } from '@/features/review';
import type { TourReviewContext } from '@/features/review/types';
import { TourGuestSelector } from './TourGuestSelector';
import styles from './tour-detail.module.css';
export function TourBookingCard({ tour }: { tour: TourReviewContext }) {
  const router = useRouter();
  const authenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);
  const [selected, setSelected] = useState('');
  const [guests, setGuests] = useState<GuestCounts>({ adults: 1, children: 0, infants: 0 });
  const departures = (tour.departures ?? []).filter(item => item.isOpen && item.remaining > 0 && new Date(item.date).getTime() > Date.now());
  const departure = departures.find(item => item.id === selected) ?? departures[0];
  const price = departure?.price ?? tour.basePrice;
  const count = guestTotal(guests);
  const max = Math.min(50, departure?.remaining ?? 0);
  const valid = !!departure && count <= max;
  let total = 0;
  try { total = calculateGuestPrice(price, count, guests, tour.agePricing).subtotal; } catch { /* Invalid selections cannot be submitted. */ }
  const action = () => {
    if (!authenticated) { router.push('/login'); return; }
    if (role !== 'TRAVELER' || !departure || !valid || !total) return;
      const params = new URLSearchParams({ tourId: tour.id, departureId: departure.id, participants: String(count), ...(tour.agePricing ? { adults: String(guests.adults), children: String(guests.children), infants: String(guests.infants) } : {}) });
      router.push(`/traveler/bookings/new?${params}`);
  };
  return <aside className={styles.booking} aria-label="Đặt tour"><div className={styles.priceHeader}><p>Giá từ</p><strong>{formatVnd(price)}</strong><small>/ khách</small><div className={styles.tourCode}><span>Mã tham chiếu</span><span>{tour.id.slice(0, 8).toUpperCase()}</span></div></div>
    <div className={styles.bookingBody}><h2 className={styles.bookingLabel}>NGÀY KHỞI HÀNH</h2>{departures.length ? <div className={styles.departureGrid}>{departures.map(item => <button type="button" key={item.id} aria-pressed={departure?.id === item.id} aria-label={`Khởi hành ${new Date(item.date).toLocaleDateString('vi-VN')}`} onClick={() => { setSelected(item.id); setGuests({ adults: 1, children: 0, infants: 0 }); }}>{new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}<small>{formatVnd(item.price)}</small></button>)}</div> : <p className={styles.muted}>Tour hiện chưa có ngày khởi hành còn chỗ.</p>}
      {departure && <><h2 className={styles.bookingLabel}>SỐ NGƯỜI · CÒN {departure.remaining} CHỖ</h2><TourGuestSelector value={guests} onChange={setGuests} max={max} unitPrice={price} pricing={tour.agePricing} /><div className={styles.totals}><div><span>Người lớn × {guests.adults}</span><span>{formatVnd(price * guests.adults)}</span></div>{guests.children > 0 && <div><span>Trẻ em × {guests.children}</span><span>{formatVnd(Math.round(price * (tour.agePricing?.childPercent ?? 100) / 100) * guests.children)}</span></div>}{guests.infants > 0 && <div><span>Em bé × {guests.infants}</span><span>{formatVnd(Math.round(price * (tour.agePricing?.infantPercent ?? 100) / 100) * guests.infants)}</span></div>}<div><span>Tổng cộng</span><strong>{formatVnd(total)}</strong></div></div></>}
      {(!authenticated || role === 'TRAVELER') && <button type="button" className={styles.primaryButton} disabled={!valid || !total} onClick={action}>{authenticated ? 'Yêu cầu đặt tour' : 'Đăng nhập để đặt tour'}<ArrowRight size={17} /></button>}
      {role === 'TRAVELER' && tour.guide && <StartConversationButton participantId={tour.guide.id} tourId={tour.id} />}
      <p className={styles.footnote}>Giá và ưu đãi sẽ được kiểm tra lại trước khi xác nhận đặt chỗ. Mỗi hành khách, kể cả em bé, được tính một chỗ.</p>
    </div>
  </aside>;
}
