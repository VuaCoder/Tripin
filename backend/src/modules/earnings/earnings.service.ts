import { isUniqueViolation } from '../../config/database';
import { buildPage, type Page } from '../../utils/pagination';
import type { BookingFacts } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { toursService, type ToursService } from '../tours';
import { toEarningDto } from './earnings.mapper';
import { earningsRepository, type EarningsRepository } from './earnings.repository';
import type { EarningDto, EarningsRange, EarningsSummaryDto, ListEarningsQuery } from './earnings.types';

export class EarningsService {
  constructor(
    private readonly earnings: Pick<EarningsRepository, 'create' | 'findByBookingId' | 'listByGuide' | 'summarize'> = earningsRepository,
    private readonly tours: Pick<ToursService, 'getTourFacts'> = toursService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  /**
   * Called when a booking is COMPLETED (see `index.ts`). If the tour has a guide who ACCEPTED the assignment, the guide
   * earns the fee the agency agreed when assigning them (DECISIONS D-19), once per booking. Returns null when nobody earns.
   */
  async recordForBooking(booking: BookingFacts): Promise<EarningDto | null> {
    const tour = await this.tours.getTourFacts(booking.tourId);
    if (!tour?.guideId || tour.guideFee === undefined) return null;

    const existing = await this.earnings.findByBookingId(booking.id);
    if (existing) return toEarningDto(existing);

    try {
      const created = await this.earnings.create({
        guideId: tour.guideId,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        tourId: booking.tourId,
        tourTitle: booking.tourTitle,
        agencyId: booking.agencyId,
        amount: tour.guideFee,
        earnedAt: new Date(),
      });
      await this.notifications.notify(tour.guideId, {
        type: NOTIFICATION_TYPE.EARNING_RECORDED,
        title: 'New earning',
        body: `You earned ${tour.guideFee.toLocaleString('en-US')} VND for "${booking.tourTitle}".`,
        data: { bookingId: booking.id },
      });
      return toEarningDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.earnings.findByBookingId(booking.id); // another event won the race
        return raced ? toEarningDto(raced) : null;
      }
      throw error;
    }
  }

  /** Use case "View earnings": the guide's own entries, newest first, optionally within a date range. */
  async listMine(guideId: string, query: ListEarningsQuery): Promise<Page<EarningDto>> {
    const { items, total } = await this.earnings.listByGuide(guideId, { from: query.from, to: query.to }, query);
    return buildPage(items.map(toEarningDto), total, query);
  }

  async summaryMine(guideId: string, range: EarningsRange): Promise<EarningsSummaryDto> {
    const byMonth = await this.earnings.summarize(guideId, range);
    return {
      totalAmount: byMonth.reduce((sum, row) => sum + row.totalAmount, 0),
      count: byMonth.reduce((sum, row) => sum + row.count, 0),
      byMonth,
    };
  }
}

export const earningsService = new EarningsService();
