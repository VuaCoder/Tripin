import { logger } from '../../utils/logger';
import type { BookingFacts } from './bookings.types';

type Handler = (booking: BookingFacts) => Promise<void> | void;

/**
 * Tiny in-process event bus for booking lifecycle facts. It lets later modules (earnings, e-tickets) react
 * WITHOUT `bookings` importing them (which would create a dependency cycle). Handlers must be idempotent and
 * their failures never fail the booking transition — they are logged.
 *
 * Register from the consumer module's service file: `bookingEvents.onCompleted(handler)`.
 */
class BookingEvents {
  private readonly completed: Handler[] = [];
  private readonly confirmed: Handler[] = [];
  private readonly cancelled: Handler[] = [];

  onCompleted(handler: Handler): void {
    this.completed.push(handler);
  }

  onConfirmed(handler: Handler): void {
    this.confirmed.push(handler);
  }

  onCancelled(handler: Handler): void {
    this.cancelled.push(handler);
  }

  emitCompleted(booking: BookingFacts): Promise<void> {
    return this.run('completed', this.completed, booking);
  }

  emitConfirmed(booking: BookingFacts): Promise<void> {
    return this.run('confirmed', this.confirmed, booking);
  }

  emitCancelled(booking: BookingFacts): Promise<void> {
    return this.run('cancelled', this.cancelled, booking);
  }

  private async run(name: string, handlers: Handler[], booking: BookingFacts): Promise<void> {
    for (const handler of handlers) {
      try {
        await handler(booking);
      } catch (error) {
        logger.error(`Booking ${name} handler failed for ${booking.bookingCode}`, { message: (error as Error).message });
      }
    }
  }
}

export const bookingEvents = new BookingEvents();
