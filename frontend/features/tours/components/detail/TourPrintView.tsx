'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Printer, ChevronLeft, Minus, Plus } from 'lucide-react';
import { ageUnitPrice, calculateGuestPrice, guestTotal, type GuestCounts } from '@travel-platform/constants';
import type { TourReviewContext } from '@/features/review/types';
import { formatVnd, formatDepartureDate } from '../../utils';
import { readSearchGuests } from '../../utils/searchContext';
import styles from './tour-print.module.css';

export function TourPrintView({ tour }: { tour: TourReviewContext }) {
  const searchParams = useSearchParams();
  
  // Initialize guests from query params or default
  const [guests, setGuests] = useState<GuestCounts>(() => readSearchGuests(searchParams));

  // Departures
  const departures = [...(tour.departures ?? [])]
    .filter(d => d.isOpen && d.remaining > 0 && new Date(d.date).getTime() >= new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Selected departure
  const selectedDepId = searchParams?.get('departureId');
  const [selectedDepartureId, setSelectedDepartureId] = useState<string>(() => {
    if (selectedDepId && departures.some(d => d.id === selectedDepId)) return selectedDepId;
    return departures[0]?.id ?? '';
  });

  const activeDeparture = departures.find(d => d.id === selectedDepartureId) || departures[0];
  const unitPrice = activeDeparture?.price ?? tour.basePrice;

  // Prices per age group
  const childUnitPrice = ageUnitPrice(unitPrice, tour.agePricing, 'child');
  const infantUnitPrice = ageUnitPrice(unitPrice, tour.agePricing, 'infant');

  // Total calculation
  const totalCount = guestTotal(guests);
  let totalPrice = 0;
  try {
    totalPrice = calculateGuestPrice(unitPrice, totalCount, guests, tour.agePricing).subtotal;
  } catch {
    totalPrice = (unitPrice * guests.adults) + 
      ((childUnitPrice ?? unitPrice) * guests.children) + 
      ((infantUnitPrice ?? 0) * guests.infants);
  }

  // Images for gallery
  const allImages = (tour.images && tour.images.length > 0)
    ? tour.images
    : tour.coverImage
      ? [tour.coverImage]
      : [];
  const mainImage = allImages[0] || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';
  const subImage1 = allImages[1] || allImages[0] || mainImage;
  const subImage2 = allImages[2] || allImages[1] || mainImage;

  // Overview content points
  const overviewPoints = tour.summary
    ? tour.summary.split('\n').filter(s => s.trim().length > 0)
    : tour.description
      ? tour.description.split('\n').filter(s => s.trim().length > 0)
      : [];

  return (
    <main className={styles.page}>
      {/* Top action toolbar (hidden on print) */}
      <nav className={styles.topBar} aria-label="Thao tác bản in">
        <Link href={`/tours/${tour.id}`} className={styles.backBtn}>
          <ChevronLeft size={18} />
          <span>Quay lại</span>
        </Link>
        <span className={styles.pageTitle}>Trang In Chương Trình</span>
        <button
          type="button"
          onClick={() => window.print()}
          className={styles.printBtn}
          aria-label="In chương trình"
        >
          <Printer size={16} />
          <span>In chương trình</span>
        </button>
      </nav>

      <article className={styles.document}>
        {/* =========================================================================
            ẢNH 1: HÌNH ẢNH TOURS + TIÊU ĐỀ TOUR + GIÁ THAM KHẢO + CÁC THÔNG TIN CHUYẾN ĐI
            ========================================================================= */}
        <section className={styles.headerSection}>
          {/* Photos Grid */}
          <div className={styles.photoGrid}>
            <div className={styles.photoMain}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainImage} alt={tour.title} crossOrigin="anonymous" />
            </div>
            <div className={styles.photoSubCol}>
              <div className={styles.photoSub}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={subImage1} alt={`${tour.title} 2`} crossOrigin="anonymous" />
              </div>
              <div className={styles.photoSub}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={subImage2} alt={`${tour.title} 3`} crossOrigin="anonymous" />
              </div>
            </div>
          </div>

          {/* Tour Title & Ref Price */}
          <div className={styles.titlePriceRow}>
            <div>
              <p className={styles.eyebrow}>CHƯƠNG TRÌNH TOUR</p>
              <h1 className={styles.tourTitle}>{tour.title}</h1>
            </div>
            <div className={styles.priceBox}>
              <span className={styles.priceLabel}>GIÁ THAM KHẢO TỪ</span>
              <span className={styles.priceAmount}>{formatVnd(unitPrice)}</span>
            </div>
          </div>

          {/* Trip Meta Facts */}
          <div className={styles.metaGrid}>
            <div>
              <span className={styles.metaLabel}>Nơi khởi hành:</span>
              <span className={styles.metaValue}>{tour.destination || 'Việt Nam'}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Thời gian:</span>
              <span className={styles.metaValue}>{tour.durationDays} ngày {Math.max(0, tour.durationDays - 1)} đêm</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Phương tiện:</span>
              <span className={styles.metaValue}>Ô tô máy lạnh / Máy bay</span>
            </div>
            {tour.agency && (
              <div>
                <span className={styles.metaLabel}>Đơn vị tổ chức:</span>
                <span className={styles.metaValue}>{tour.agency.name}</span>
              </div>
            )}
          </div>
        </section>

        {/* =========================================================================
            ẢNH 2: LỊCH KHỞI HÀNH & BẢNG GIÁ (CHỌN KHÁCH, BẢNG CHI TIẾT NGƯỜI LỚN, TRẺ EM, EM BÉ)
            ========================================================================= */}
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeaderRow}>
            <h2 className={styles.sectionTitle}>Lịch khởi hành & Bảng giá</h2>
            
            {/* Interactive Guest Controls (Hidden on print) */}
            <div className={`${styles.guestSelectorToolbar} no-print`}>
              <div className={styles.guestControlItem}>
                <span className={styles.guestItemLabel}>Người lớn:</span>
                <div className={styles.counterGroup}>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, adults: Math.max(1, prev.adults - 1) }))}
                    disabled={guests.adults <= 1}
                    aria-label="Giảm người lớn"
                  >
                    <Minus size={13} />
                  </button>
                  <span className={styles.counterVal}>{guests.adults}</span>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, adults: prev.adults + 1 }))}
                    aria-label="Tăng người lớn"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              <div className={styles.guestControlItem}>
                <span className={styles.guestItemLabel}>Trẻ em:</span>
                <div className={styles.counterGroup}>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, children: Math.max(0, prev.children - 1) }))}
                    disabled={guests.children <= 0}
                    aria-label="Giảm trẻ em"
                  >
                    <Minus size={13} />
                  </button>
                  <span className={styles.counterVal}>{guests.children}</span>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, children: prev.children + 1 }))}
                    aria-label="Tăng trẻ em"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              <div className={styles.guestControlItem}>
                <span className={styles.guestItemLabel}>Em bé:</span>
                <div className={styles.counterGroup}>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, infants: Math.max(0, prev.infants - 1) }))}
                    disabled={guests.infants <= 0}
                    aria-label="Giảm em bé"
                  >
                    <Minus size={13} />
                  </button>
                  <span className={styles.counterVal}>{guests.infants}</span>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, infants: prev.infants + 1 }))}
                    aria-label="Tăng em bé"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Table (Matches Ảnh 2) */}
          <div className={styles.tableWrapper}>
            <table className={styles.priceTable}>
              <thead>
                <tr>
                  <th>Mã Tour</th>
                  <th>Ngày xuất phát</th>
                  <th>Người lớn (x{guests.adults})</th>
                  <th>Trẻ em (x{guests.children})</th>
                  <th>Em bé (x{guests.infants})</th>
                  <th>Tổng dự tính</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.monoCell}>{tour.id.slice(0, 16).toUpperCase()}</td>
                  <td>{activeDeparture ? formatDepartureDate(activeDeparture.date) : 'Theo yêu cầu'}</td>
                  <td className={styles.amountCol}>{formatVnd(unitPrice * guests.adults)}</td>
                  <td className={styles.amountCol}>
                    {guests.children > 0
                      ? formatVnd((childUnitPrice ?? unitPrice) * guests.children)
                      : childUnitPrice !== null
                        ? formatVnd(childUnitPrice)
                        : '0 ₫'}
                  </td>
                  <td className={styles.amountCol}>
                    {guests.infants > 0
                      ? formatVnd((infantUnitPrice ?? 0) * guests.infants)
                      : infantUnitPrice !== null
                        ? formatVnd(infantUnitPrice)
                        : '0 ₫'}
                  </td>
                  <td className={styles.totalCol}>{formatVnd(totalPrice)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Departure Selector if multiple dates (Screen only) */}
          {departures.length > 1 && (
            <div className={`${styles.departurePills} no-print`}>
              <span className="text-xs font-semibold text-slate-500">Chọn ngày khởi hành khác:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {departures.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDepartureId(d.id)}
                    className={`${styles.departurePill} ${selectedDepartureId === d.id ? styles.departurePillActive : ''}`}
                  >
                    {formatDepartureDate(d.date)} ({formatVnd(d.price)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tổng quan (Matches Ảnh 2 dưới bảng giá) */}
          <div className={styles.overviewBox}>
            <h3 className={styles.overviewTitle}>Tổng quan</h3>
            {overviewPoints.length > 0 ? (
              <ul className={styles.bulletList}>
                {overviewPoints.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.simpleText}>
                Hành trình khám phá {tour.destination} với nhiều trải nghiệm hấp dẫn và phong cảnh độc đáo.
              </p>
            )}
          </div>
        </section>

        {/* =========================================================================
            ẢNH 3: CHƯƠNG TRÌNH TOUR (LỊCH TRÌNH TỪNG NGÀY)
            ========================================================================= */}
        <section className={styles.sectionBlock}>
          <h2 className={styles.sectionTitle}>Chương trình tour</h2>
          
          <div className={styles.itineraryList}>
            {tour.itinerary?.length ? (
              [...tour.itinerary].sort((a, b) => a.day - b.day).map((day) => (
                <div key={day.day} className={styles.dayItem}>
                  <div className={styles.dayHeader}>
                    <span className={styles.dayDot} />
                    <h3 className={styles.dayTitle}>
                      Ngày {String(day.day).padStart(2, '0')}: {day.title}
                    </h3>
                  </div>
                  <div className={styles.dayBody}>
                    {day.description && <p className={styles.dayDescription}>{day.description}</p>}
                    {day.activities && day.activities.length > 0 && (
                      <ul className={styles.dayActivities}>
                        {day.activities.map((act, idx) => (
                          <li key={idx}>{act}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.simpleText}>Đơn vị tổ chức đang cập nhật lịch trình chi tiết.</p>
            )}
          </div>
        </section>

        {/* =========================================================================
            ẢNH 4: DỊCH VỤ BAO GỒM & KHÔNG BAO GỒM, VÉ TRẺ EM, HƯỚNG DẪN ĐỔI HỦY
            ========================================================================= */}
        <section className={styles.sectionBlock}>
          <h2 className={styles.sectionTitle}>Dịch vụ bao gồm & không bao gồm</h2>

          <div className={styles.servicesBox}>
            <h3 className={styles.servicesSubhead}>Bao gồm / Không bao gồm</h3>

            {/* Giá tour bao gồm */}
            <div className={styles.serviceGroup}>
              <h4 className={styles.groupHeading}>Giá tour bao gồm</h4>
              {tour.inclusions && tour.inclusions.length > 0 ? (
                <ul className={styles.bulletList}>
                  {tour.inclusions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.simpleText}>Theo tiêu chuẩn chương trình trọn gói.</p>
              )}
            </div>

            {/* Giá tour không bao gồm */}
            <div className={styles.serviceGroup}>
              <h4 className={styles.groupHeading}>Giá tour không bao gồm</h4>
              {tour.exclusions && tour.exclusions.length > 0 ? (
                <ul className={styles.bulletList}>
                  {tour.exclusions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.simpleText}>Chi phí cá nhân ngoài chương trình.</p>
              )}
            </div>

            {/* Vé trẻ em */}
            <div className={styles.serviceGroup}>
              <h4 className={styles.groupHeading}>Vé trẻ em</h4>
              {tour.childPricingPolicy ? (
                <p className={styles.simpleText}>{tour.childPricingPolicy}</p>
              ) : (
                <ul className={styles.bulletList}>
                  <li>
                    Trẻ em từ 2 đến dưới 12 tuổi:{' '}
                    {tour.agePricing?.childPrice
                      ? formatVnd(tour.agePricing.childPrice)
                      : tour.agePricing?.childPercent
                        ? `${tour.agePricing.childPercent}% giá người lớn`
                        : '80% giá người lớn (bé ngủ chung giường với Bố Mẹ).'}
                  </li>
                  <li>
                    Em bé dưới 2 tuổi:{' '}
                    {tour.agePricing?.infantPrice
                      ? formatVnd(tour.agePricing.infantPrice)
                      : tour.agePricing?.infantPercent
                        ? `${tour.agePricing.infantPercent}% giá người lớn`
                        : 'Miễn phí hoặc theo phụ thu dịch vụ của hãng vận chuyển.'}
                  </li>
                </ul>
              )}
            </div>

            {/* Hướng dẫn & Lưu ý */}
            {(tour.travelNotes || tour.cancellationPolicy || tour.requiredDocuments) && (
              <div className={styles.serviceGroup}>
                <h4 className={styles.groupHeading}>Lưu ý & Điều kiện đổi hủy</h4>
                {tour.travelNotes && <p className={styles.simpleText}><strong>Lưu ý:</strong> {tour.travelNotes}</p>}
                {tour.cancellationPolicy && <p className={styles.simpleText}><strong>Điều kiện hủy tour:</strong> {tour.cancellationPolicy}</p>}
                {tour.requiredDocuments && <p className={styles.simpleText}><strong>Giấy tờ tùy thân:</strong> {tour.requiredDocuments}</p>}
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.documentFooter}>
          <p>© {new Date().getFullYear()} Tripri Travel Platform. Chương trình du lịch chính thức được phát hành bởi đơn vị tổ chức.</p>
        </footer>
      </article>
    </main>
  );
}
