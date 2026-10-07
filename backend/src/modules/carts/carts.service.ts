import { AppError } from '../../utils/app-error';
import { toursDiscoveryService, toursService, type ToursDiscoveryService, type ToursService } from '../tours';
import { toCartItemDto, toCartTotals } from './carts.mapper';
import { cartsRepository, type CartItemRecord, type CartsRepository } from './carts.repository';
import { CART_LIMITS, type AddCartItemInput, type CartDto, type CartItemDto, type UpdateCartItemInput } from './carts.types';

type Repo = Pick<CartsRepository, 'upsert' | 'findById' | 'exists' | 'count' | 'updateParticipants' | 'remove' | 'listByUser'>;

/**
 * The traveler's cart: a shortlist of tour departures they intend to book. It stores a selection only
 * (`tourId`, `departureId`, participants) — never a price or a seat hold. Availability and money are derived from the
 * live `tours` data on every read, and the booking re-prices everything server-side at checkout.
 */
export class CartsService {
  constructor(
    private readonly items: Repo = cartsRepository,
    private readonly tours: Pick<ToursService, 'getBookableDeparture' | 'getDepartureFacts'> = toursService,
    private readonly discovery: Pick<ToursDiscoveryService, 'getPublicCards'> = toursDiscoveryService,
  ) {}

  /** The whole cart with live availability and totals. Unavailable lines are kept and flagged, never hidden. */
  async list(userId: string): Promise<CartDto> {
    const rows = await this.items.listByUser(userId);
    if (rows.length === 0) return { items: [], totals: toCartTotals([]) };

    const [cards, facts] = await Promise.all([
      this.discovery.getPublicCards(rows.map((row) => row.tourId)),
      this.tours.getDepartureFacts(rows.map((row) => ({ tourId: row.tourId, departureId: row.departureId }))),
    ]);
    const items = rows.map((row) => toCartItemDto(row, cards.get(row.tourId), facts.get(this.key(row.tourId, row.departureId))));
    return { items, totals: toCartTotals(items) };
  }

  /**
   * Use case "Add tour to cart". The tour must be public and the departure bookable with enough seats; adding the same
   * departure twice replaces its head-count instead of creating a second line (safe under double-clicks).
   */
  async add(userId: string, input: AddCartItemInput): Promise<{ created: boolean; item: CartItemDto }> {
    const departure = await this.tours.getBookableDeparture(input.tourId, input.departureId);
    if (input.participants > departure.remaining) {
      throw AppError.conflict('Not enough seats left on this departure', 'NOT_ENOUGH_SEATS');
    }

    const existing = await this.items.exists(userId, input.departureId);
    if (!existing && (await this.items.count(userId)) >= CART_LIMITS.MAX_ITEMS) {
      throw AppError.conflict(`Your cart is full (${CART_LIMITS.MAX_ITEMS} departures)`, 'CART_FULL');
    }

    const row = await this.items.upsert({
      userId,
      tourId: input.tourId,
      departureId: input.departureId,
      participants: input.participants,
    });
    return { created: !existing, item: await this.describe(row) };
  }

  /**
   * Change the head-count of one of MY lines. The line exists and is mine (a foreign id already answered 404), so a
   * tour/departure that stopped being bookable is a 409 with the reason, never a 404.
   */
  async updateParticipants(userId: string, itemId: string, input: UpdateCartItemInput): Promise<CartItemDto> {
    const row = await this.requireOwned(userId, itemId);
    const [cards, facts] = await Promise.all([
      this.discovery.getPublicCards([row.tourId]),
      this.tours.getDepartureFacts([{ tourId: row.tourId, departureId: row.departureId }]),
    ]);
    const departure = facts.get(this.key(row.tourId, row.departureId));
    if (!cards.has(row.tourId) || !departure || !departure.bookable) {
      throw AppError.conflict('This departure is closed or sold out', 'DEPARTURE_UNAVAILABLE');
    }
    if (input.participants > departure.remaining) {
      throw AppError.conflict('Not enough seats left on this departure', 'NOT_ENOUGH_SEATS');
    }
    const updated = await this.items.updateParticipants(userId, row.id, input.participants);
    if (!updated) throw AppError.notFound('Cart item not found');
    return this.describe(updated);
  }

  /** Idempotent: removing a line that is already gone (or belongs to somebody else) succeeds silently. */
  async remove(userId: string, itemId: string): Promise<void> {
    await this.items.remove(userId, itemId);
  }

  // ============================================================== helpers

  /** 404 (never 403) for a line that is not the caller's, so ids of other travelers are not revealed. */
  private async requireOwned(userId: string, itemId: string): Promise<CartItemRecord> {
    const row = await this.items.findById(itemId);
    if (!row || row.userId !== userId) throw AppError.notFound('Cart item not found');
    return row;
  }

  /** Re-reads the live tour card / departure facts for one line and maps it to the API DTO. */
  private async describe(row: CartItemRecord): Promise<CartItemDto> {
    const [cards, facts] = await Promise.all([
      this.discovery.getPublicCards([row.tourId]),
      this.tours.getDepartureFacts([{ tourId: row.tourId, departureId: row.departureId }]),
    ]);
    return toCartItemDto(row, cards.get(row.tourId), facts.get(this.key(row.tourId, row.departureId)));
  }

  private key(tourId: string, departureId: string): string {
    return `${tourId}:${departureId}`;
  }
}

export const cartsService = new CartsService();
