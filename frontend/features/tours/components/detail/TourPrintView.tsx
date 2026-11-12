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

  const adultLineTotal = unitPrice * guests.adults;
  const childLineTotal = (childUnitPrice ?? unitPrice) * guests.children;
  const infantLineTotal = (infantUnitPrice ?? 0) * guests.infants;

  // Total calculation
  const totalCount = guestTotal(guests);
  let totalPrice = 0;
  try {
    totalPrice = calculateGuestPrice(unitPrice, totalCount, guests, tour.agePricing).subtotal;
  } catch {
    totalPrice = adultLineTotal + childLineTotal + infantLineTotal;
  }

  // Images for 3-frame collage (Saigontourist style)
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
    ? tour.summary.split('\n').map(s => s.trim()).filter(Boolean)
    : tour.description
      ? tour.description.split('\n').map(s => s.trim()).filter(Boolean)
      : [];

  // Format readable tour code
  const displayTourCode = tour.id.length > 16
    ? `TRP-${tour.id.slice(0, 8).toUpperCase()}`
    : tour.id.toUpperCase();

  // Back link preserves current guest selection
  const backParams = new URLSearchParams();
  if (selectedDepartureId) backParams.set('departureId', selectedDepartureId);
  backParams.set('adults', String(guests.adults));
  backParams.set('children', String(guests.children));
  backParams.set('infants', String(guests.infants));
  const backHref = `/tours/${tour.id}?${backParams.toString()}`;

  return (
    <main className={styles.page}>
      {/* Top sticky action bar (Matches Ảnh 1 header, hidden when printing) */}
      <nav className={styles.topBar} aria-label="Thao tác bản in">
        <Link href={backHref} className={styles.backBtn}>
          <ChevronLeft size={16} strokeWidth={2.5} />
          <span>Quay lại</span>
        </Link>
        <span className={styles.pageTitle}>Trang In Chương Trình</span>
        <button
          type="button"
          onClick={() => window.print()}
          className={styles.printBtn}
          aria-label="In chương trình"
        >
          <Printer size={15} />
          <span>In chương trình</span>
        </button>
      </nav>

      <article className={styles.document}>
        {/* =========================================================================
            ẢNH 1: GALLERY 3 ẢNH + TIÊU ĐỀ TOUR & GIÁ THAM KHẢO + THÔNG TIN CHUYẾN ĐI
            ========================================================================= */}
        <section className={styles.headerSection}>
          <div className={styles.photoGrid}>
            <div className={styles.photoMain}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainImage} alt={tour.title} crossOrigin="anonymous" />
            </div>
            <div className={styles.photoSubCol}>
              <div className={styles.photoSub}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={subImage1} alt={`${tour.title} - ảnh 2`} crossOrigin="anonymous" />
              </div>
              <div className={styles.photoSub}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={subImage2} alt={`${tour.title} - ảnh 3`} crossOrigin="anonymous" />
              </div>
            </div>
          </div>

          <div className={styles.titlePriceRow}>
            <div className={styles.titleCol}>
              <p className={styles.eyebrow}>CHƯƠNG TRÌNH TOUR</p>
              <h1 className={styles.tourTitle}>{tour.title}</h1>
            </div>
            <div className={styles.priceBox}>
              <span className={styles.priceLabel}>GIÁ THAM KHẢO TỪ</span>
              <span className={styles.priceAmount}>{formatVnd(unitPrice)}</span>
            </div>
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Nơi khởi hành:</span>
              <span className={styles.metaValue}>{tour.destination || 'Việt Nam'}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Thời gian:</span>
              <span className={styles.metaValue}>
                {tour.durationDays} ngày {Math.max(0, tour.durationDays - 1)} đêm
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Phương tiện:</span>
              <span className={styles.metaValue}>Ô tô du lịch / Máy bay</span>
            </div>
            {tour.agency && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Đơn vị tổ chức:</span>
                <span className={styles.metaValue}>{tour.agency.name}</span>
              </div>
            )}
          </div>
        </section>

        {/* =========================================================================
            ẢNH 2: LỊCH KHỞI HÀNH & BẢNG GIÁ + TỔNG QUAN
            ========================================================================= */}
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeadingBar}>
            <h2 className={styles.sectionTitle}>Lịch khởi hành & Bảng giá</h2>

            {/* Bộ chỉnh số lượng hành khách trực tiếp trên bản xem trước (ẩn khi in giấy) */}
            <div className={styles.guestSelectorToolbar}>
              <div className={styles.guestControlItem}>
                <span className={styles.guestItemLabel}>Người lớn:</span>
                <div className={styles.counterGroup}>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, adults: Math.max(1, prev.adults - 1) }))}
                    disabled={guests.adults <= 1}
                    aria-label="Giảm người lớn"
                  >
                    <Minus size={12} />
                  </button>
                  <span className={styles.counterVal}>{guests.adults}</span>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, adults: prev.adults + 1 }))}
                    aria-label="Tăng người lớn"
                  >
                    <Plus size={12} />
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
                    <Minus size={12} />
                  </button>
                  <span className={styles.counterVal}>{guests.children}</span>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, children: prev.children + 1 }))}
                    aria-label="Tăng trẻ em"
                  >
                    <Plus size={12} />
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
                    <Minus size={12} />
                  </button>
                  <span className={styles.counterVal}>{guests.infants}</span>
                  <button
                    type="button"
                    onClick={() => setGuests(prev => ({ ...prev, infants: prev.infants + 1 }))}
                    aria-label="Tăng em bé"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chọn ngày khởi hành khác nếu tour có nhiều lịch */}
          {departures.length > 1 && (
            <div className={styles.departurePills}>
              <span className={styles.departurePillsLabel}>Chọn ngày khởi hành:</span>
              <div className={styles.departurePillsRow}>
                {departures.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDepartureId(d.id)}
                    className={`${styles.departurePill} ${selectedDepartureId === d.id ? styles.departurePillActive : ''}`}
                  >
                    {formatDepartureDate(d.date)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.tableWrapper}>
            <table className={styles.priceTable}>
              <thead>
                <tr>
                  <th>Mã Tour</th>
                  <th>Ngày xuất phát</th>
                  <th className={styles.rightAlign}>Người lớn ({guests.adults})</th>
                  <th className={styles.rightAlign}>Trẻ em ({guests.children})</th>
                  <th className={styles.rightAlign}>Em bé ({guests.infants})</th>
                  <th className={styles.rightAlign}>Tổng thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.codeCell}>{displayTourCode}</td>
                  <td className={styles.dateCell}>
                    {activeDeparture ? formatDepartureDate(activeDeparture.date) : 'Theo yêu cầu'}
                  </td>
                  <td className={styles.priceHighlightCell}>
                    <div>{formatVnd(adultLineTotal)}</div>
                    <span className={styles.unitSubtext}>
                      {guests.adults} khách × {formatVnd(unitPrice)}
                    </span>
                  </td>
                  <td className={styles.priceNormalCell}>
                    <div>
                      {guests.children > 0
                        ? formatVnd(childLineTotal)
                        : childUnitPrice !== null
                          ? formatVnd(childUnitPrice)
                          : '0 ₫'}
                    </div>
                    <span className={styles.unitSubtext}>
                      {guests.children > 0
                        ? `${guests.children} khách × ${formatVnd(childUnitPrice ?? unitPrice)}`
                        : 'Đơn giá / trẻ em'}
                    </span>
                  </td>
                  <td className={styles.priceNormalCell}>
                    <div>
                      {guests.infants > 0
                        ? formatVnd(infantLineTotal)
                        : infantUnitPrice !== null
                          ? formatVnd(infantUnitPrice)
                          : '0 ₫'}
                    </div>
                    <span className={styles.unitSubtext}>
                      {guests.infants > 0
                        ? `${guests.infants} khách × ${formatVnd(infantUnitPrice ?? 0)}`
                        : 'Đơn giá / em bé'}
                    </span>
                  </td>
                  <td className={styles.totalAmountCell}>
                    <div>{formatVnd(totalPrice)}</div>
                    <span className={styles.unitSubtext}>Tổng {totalCount} hành khách</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.overviewSection}>
            <h2 className={styles.sectionTitleWithBorder}>Tổng quan</h2>
            {overviewPoints.length > 0 ? (
              <ul className={styles.overviewList}>
                {overviewPoints.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.simpleText}>
                Hành trình khám phá {tour.destination} với lịch trình chọn lọc, dịch vụ chu đáo và trải nghiệm văn hóa bản địa đặc sắc.
              </p>
            )}
          </div>
        </section>

        {/* =========================================================================
            ẢNH 3: CHƯƠNG TRÌNH TOUR (TIMELINE NGÀY 01, 02, 03...)
            ========================================================================= */}
        <section className={styles.sectionBlock}>
          <h2 className={styles.sectionTitleWithBorder}>Chương trình tour</h2>

          <div className={styles.timelineContainer}>
            {tour.itinerary?.length ? (
              [...tour.itinerary]
                .sort((a, b) => a.day - b.day)
                .map((day, idx, arr) => (
                  <div
                    key={day.day}
                    className={`${styles.timelineDay} ${idx === arr.length - 1 ? styles.timelineDayLast : ''}`}
                  >
                    <div className={styles.timelineMarkerCol}>
                      <span className={styles.timelineDot} />
                      {idx < arr.length - 1 && <span className={styles.timelineLine} />}
                    </div>
                    <div className={styles.timelineContent}>
                      <h3 className={styles.dayTitle}>
                        Ngày {String(day.day).padStart(2, '0')}: {day.title}
                      </h3>
                      {day.description && <p className={styles.dayDescription}>{day.description}</p>}
                      {day.activities && day.activities.length > 0 && (
                        <ul className={styles.dayActivities}>
                          {day.activities.map((act, actIdx) => (
                            <li key={actIdx}>{act}</li>
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
            ẢNH 4: DỊCH VỤ BAO GỒM & KHÔNG BAO GỒM, VÉ TRẺ EM, LƯU Ý & ĐỔI HỦY
            ========================================================================= */}
        <section className={styles.sectionBlock}>
          <h2 className={styles.sectionTitleWithBorder}>Dịch vụ bao gồm & không bao gồm</h2>

          <div className={styles.servicesCard}>
            <h3 className={styles.servicesCardHeader}>Bao gồm / Không bao gồm</h3>

            {/* Giá tour bao gồm */}
            <div className={styles.serviceGroup}>
              <h4 className={styles.groupHeading}>Giá tour bao gồm</h4>
              {tour.inclusions && tour.inclusions.length > 0 ? (
                <ul className={styles.squareBulletList}>
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
                <ul className={styles.squareBulletList}>
                  {tour.exclusions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.simpleText}>Chi phí cá nhân và các dịch vụ ngoài chương trình.</p>
              )}
            </div>

            {/* Vé trẻ em */}
            <div className={styles.serviceGroup}>
              <h4 className={styles.groupHeading}>Vé trẻ em</h4>
              {tour.childPricingPolicy ? (
                <ul className={styles.squareBulletList}>
                  <li>{tour.childPricingPolicy}</li>
                </ul>
              ) : (
                <ul className={styles.squareBulletList}>
                  <li>
                    Trẻ em từ 2 đến dưới 12 tuổi:{' '}
                    {tour.agePricing?.childPrice
                      ? formatVnd(tour.agePricing.childPrice)
                      : tour.agePricing?.childPercent
                        ? `${tour.agePricing.childPercent}% giá của người lớn (bé ngủ chung giường với Bố Mẹ).`
                        : '80% giá của người lớn (bé ngủ chung giường với Bố Mẹ).'}
                  </li>
                  <li>
                    Em bé dưới 2 tuổi:{' '}
                    {tour.agePricing?.infantPrice
                      ? formatVnd(tour.agePricing.infantPrice)
                      : tour.agePricing?.infantPercent
                        ? `${tour.agePricing.infantPercent}% giá của người lớn.`
                        : 'Miễn phí hoặc thu phí theo quy định hãng vận chuyển.'}
                  </li>
                </ul>
              )}
            </div>

            {/* Điều kiện đổi hủy & Lưu ý */}
            {(tour.travelNotes || tour.cancellationPolicy || tour.requiredDocuments) && (
              <div className={styles.serviceGroup}>
                <h4 className={styles.groupHeading}>Lưu ý & Hướng dẫn chuyến đi</h4>
                <ul className={styles.squareBulletList}>
                  {tour.travelNotes && <li>{tour.travelNotes}</li>}
                  {tour.cancellationPolicy && <li>{tour.cancellationPolicy}</li>}
                  {tour.requiredDocuments && <li>{tour.requiredDocuments}</li>}
                </ul>
              </div>
            )}
          </div>
        </section>

        <footer className={styles.documentFooter}>
          <p>© {new Date().getFullYear()} Tripri Travel Platform — Tài liệu chương trình tour du lịch.</p>
        </footer>
      </article>
    </main>
  );
}
