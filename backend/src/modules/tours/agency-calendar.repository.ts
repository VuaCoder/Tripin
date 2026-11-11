import { prisma, type Prisma } from '../../config/database';
import { Prisma as Sql } from '../../generated/prisma/client';
import type { Tour, TourDeparture } from '../../generated/prisma/client';
import { AppError } from '../../utils/app-error';
import type { CalendarQuery, CreateDeparture, UpdateDeparture } from './agency-calendar.validation';

export type CalendarDeparture = TourDeparture & {
  tourTitle: string;
  durationDays: number;
  basePrice: bigint;
  coverImage: string | null;
  tourStatus: string;
  maxGroupSize: number | null;
  agePricing: Prisma.JsonValue | null;
};
type Tx = Prisma.TransactionClient;

function eventDto(row: CalendarDeparture) {
  return {
    id: row.id, tourId: row.tourId, date: row.date.toISOString(),
    end: new Date(row.date.getTime() + row.durationDays * 86_400_000).toISOString(),
    capacity: row.capacity, remaining: row.remaining, price: Number(row.priceOverride ?? row.basePrice),
    priceOverride: row.priceOverride === null ? null : Number(row.priceOverride), isOpen: row.isOpen,
    tour: {
      id: row.tourId,
      title: row.tourTitle,
      durationDays: row.durationDays,
      basePrice: Number(row.basePrice),
      coverImage: row.coverImage,
      status: row.tourStatus,
      maxGroupSize: row.maxGroupSize,
      agePricing: row.agePricing,
    },
  };
}
function enriched(row: TourDeparture, tour: Tour): CalendarDeparture {
  return {
    ...row,
    tourTitle: tour.title,
    durationDays: tour.durationDays,
    basePrice: tour.basePrice,
    coverImage: tour.images[0] ?? null,
    tourStatus: tour.status,
    maxGroupSize: tour.maxGroupSize,
    agePricing: tour.agePricing,
  };
}
async function lockOwned(tx: Tx, agencyId: string, tourId: string) {
  const [tour] = await tx.$queryRaw<Tour[]>`SELECT * FROM "Tour" WHERE "id" = ${tourId}::uuid AND "agencyId" = ${agencyId}::uuid FOR UPDATE`;
  if (!tour || tour.status === 'ARCHIVED') throw AppError.notFound('Không tìm thấy tour đang hoạt động của bạn.');
  const rows = await tx.$queryRaw<TourDeparture[]>`SELECT * FROM "TourDeparture" WHERE "tourId" = ${tourId}::uuid ORDER BY "id" FOR UPDATE`;
  return { tour, rows };
}
function assertCurrent(row: TourDeparture | undefined, expectedDate: Date): asserts row is TourDeparture {
  if (!row) throw AppError.notFound('Đợt khởi hành không còn tồn tại.');
  if (row.date.getTime() !== expectedDate.getTime()) throw AppError.conflict('Lịch đã được thay đổi ở nơi khác. Vui lòng tải lại.', 'CONCURRENT_UPDATE');
  if (row.date.getTime() <= Date.now()) throw AppError.conflict('Đợt đã khởi hành chỉ có thể xem.');
}
function assertFuture(date: Date) {
  if (date.getTime() <= Date.now()) throw AppError.badRequest('Vui lòng chọn ngày và giờ trong tương lai.');
}

export const agencyCalendarRepository = {
  async list(agencyId: string, query: CalendarQuery) {
    const rows = await prisma.$queryRaw<CalendarDeparture[]>(Sql.sql`
      SELECT d.*, t."title" AS "tourTitle", t."durationDays", t."basePrice", t."images"[1] AS "coverImage", t."status"::text AS "tourStatus", t."maxGroupSize", t."agePricing"
      FROM "TourDeparture" d JOIN "Tour" t ON t."id" = d."tourId"
      WHERE t."agencyId" = ${agencyId}::uuid AND t."status" <> 'ARCHIVED'
        AND d."date" < ${query.to} AND d."date" + t."durationDays" * INTERVAL '1 day' > ${query.from}
        ${query.tourId ? Sql.sql`AND t."id" = ${query.tourId}::uuid` : Sql.empty}
      ORDER BY d."date", d."id" LIMIT 5001`);
    if (rows.length > 5000) throw AppError.badRequest('Lịch quá nhiều đợt. Hãy chọn một tour hoặc khoảng ngày ngắn hơn.');
    return rows.map(eventDto);
  },

  async create(agencyId: string, tourId: string, inputs: CreateDeparture[]) {
    return prisma.$transaction(async (tx) => {
      const { tour, rows } = await lockOwned(tx, agencyId, tourId);
      const existingIds = await tx.tourDeparture.findMany({ where: { id: { in: inputs.map((item) => item.id) } } });
      const events: ReturnType<typeof eventDto>[] = [];
      let created = 0, skipped = 0, replayed = 0;
      for (const input of inputs) {
        const data = { id: input.id, tourId, date: input.date, capacity: input.capacity ?? tour.maxGroupSize ?? 10, priceOverride: input.priceOverride ?? null, isOpen: input.isOpen ?? true };
        const sameId = existingIds.find((row) => row.id === input.id);
        if (sameId) {
          if (sameId.tourId !== tourId || sameId.date.getTime() !== data.date.getTime() || sameId.capacity !== data.capacity || sameId.priceOverride !== data.priceOverride || sameId.isOpen !== data.isOpen) {
            throw AppError.conflict('Mã yêu cầu này đã được dùng cho một thay đổi khác.', 'REQUEST_ALREADY_USED');
          }
          replayed++;
          events.push(eventDto(enriched(sameId, tour)));
          continue;
        }
        assertFuture(data.date);
        const duplicate = rows.find((row) => row.date.getTime() === data.date.getTime());
        if (duplicate) { skipped++; events.push(eventDto(enriched(duplicate, tour))); continue; }
        if (rows.length >= 200) throw AppError.conflict('Mỗi tour có tối đa 200 đợt khởi hành.', 'DEPARTURE_LIMIT');
        const row = await tx.tourDeparture.create({ data: { ...data, remaining: data.capacity } });
        rows.push(row);
        events.push(eventDto(enriched(row, tour)));
        created++;
      }
      return { events, created, skipped, replayed };
    });
  },

  async update(agencyId: string, tourId: string, departureId: string, input: UpdateDeparture) {
    return prisma.$transaction(async (tx) => {
      const { tour, rows } = await lockOwned(tx, agencyId, tourId);
      const current = rows.find((row) => row.id === departureId);
      assertCurrent(current, input.expectedDate);
      const date = input.date ?? current.date;
      const moved = date.getTime() !== current.date.getTime();
      const booked = current.capacity - current.remaining;
      if (moved) {
        assertFuture(date);
        if (booked > 0) throw AppError.conflict('Đợt đã có khách đặt không thể đổi ngày hoặc giờ.', 'DEPARTURE_HAS_BOOKINGS');
        if (rows.some((row) => row.id !== departureId && row.date.getTime() === date.getTime())) throw AppError.conflict('Tour đã có đợt khởi hành tại thời điểm này.', 'DEPARTURE_EXISTS');
      }
      const capacity = input.capacity ?? current.capacity;
      if (capacity < booked) throw AppError.conflict(`Sức chứa không thể thấp hơn ${booked} chỗ đã đặt.`, 'CAPACITY_BELOW_BOOKED');
      const row = await tx.tourDeparture.update({ where: { id: departureId }, data: {
        date, capacity, remaining: current.remaining + capacity - current.capacity,
        ...(input.priceOverride !== undefined ? { priceOverride: input.priceOverride } : {}),
        ...(input.isOpen !== undefined ? { isOpen: input.isOpen } : {}),
      } });
      return eventDto(enriched(row, tour));
    });
  },

  async remove(agencyId: string, tourId: string, departureId: string, expectedDate: Date) {
    await prisma.$transaction(async (tx) => {
      const { rows } = await lockOwned(tx, agencyId, tourId);
      const current = rows.find((row) => row.id === departureId);
      assertCurrent(current, expectedDate);
      if (current.remaining !== current.capacity) throw AppError.conflict('Đợt đã có khách đặt không thể xóa. Hãy đóng nhận khách.', 'DEPARTURE_HAS_BOOKINGS');
      await tx.tourDeparture.delete({ where: { id: departureId } });
    });
  },
};
