import { describe, expect, it, vi } from 'vitest';
import { ETicketsService } from '../e-tickets.service';

type T = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const GUIDE = 'g1';
const TOUR = 't1';
const ASSIGNMENT = { tour: { title: 'Ha Long 3N2Đ' } };

const stored = (over: T = {}) => ({
  id: 'e1',
  bookingId: 'b1',
  bookingCode: 'TRP-ABCD2345',
  code: 'ETK-AAAAAAAAAAAAAAAA',
  travelerId: 'u1',
  agencyId: 'a1',
  tourId: TOUR,
  tourTitle: 'Ha Long 3N2Đ',
  departureDate: new Date('2026-12-01T00:00:00Z'),
  participants: 2,
  holderName: 'Ann Nguyen',
  status: 'VALID',
  issuedAt: new Date('2026-11-01T00:00:00Z'),
  cancelledAt: null as Date | null,
  usedAt: null as Date | null,
  ...over,
});

function make({ assigned = true, tickets = [] as T[], bookings = [] as T[] } = {}) {
  const db = [...tickets];
  const repo = {
    findAcceptedAssignment: vi.fn(async () => (assigned ? ASSIGNMENT : null)),
    findByCode: vi.fn(async (code: string) => db.find((ticket) => ticket.code === code) ?? null),
    listByTour: vi.fn(async () => db.filter((ticket) => ticket.tourId === TOUR && ticket.status !== 'CANCELLED')),
    findRosterBookings: vi.fn(async (ids: string[]) => {
      const selected = bookings.filter((booking) => ids.includes(booking.id));
      return new Map(selected.map((booking) => [booking.id, booking]));
    }),
    markCheckedIn: vi.fn(async (id: string) => {
      const ticket = db.find((item) => item.id === id);
      if (!ticket || ticket.status !== 'VALID' || ticket.usedAt) return null;
      ticket.usedAt = new Date('2026-12-01T08:00:00Z');
      return ticket;
    }),
  };
  const notifications = { notify: vi.fn(async () => undefined) };
  return { service: new ETicketsService(repo as never, notifications), repo, db };
}

describe('rosterForGuide', () => {
  it('lists the tour tickets without cancelled ones and counts the checked-in groups', async () => {
    const { service } = make({
      tickets: [
        stored(),
        stored({ id: 'e2', code: 'ETK-BBBBBBBBBBBBBBBB', holderName: 'Binh', usedAt: new Date('2026-12-01T08:00:00Z') }),
        stored({ id: 'e3', code: 'ETK-CCCCCCCCCCCCCCCC', status: 'CANCELLED' }),
      ],
    });

    const roster = await service.rosterForGuide(GUIDE, TOUR);

    expect(roster).toMatchObject({ tourId: TOUR, tourTitle: 'Ha Long 3N2Đ', total: 2, checkedIn: 1 });
    expect(roster.items.map((item) => item.ticketId)).toEqual(['e1', 'e2']);
    expect(roster.items.find((item) => item.ticketId === 'e1')).toMatchObject({ checkedIn: false });
    expect(roster.items.find((item) => item.ticketId === 'e2')).toMatchObject({
      checkedIn: true,
      checkedInAt: '2026-12-01T08:00:00.000Z',
    });
  });

  it('adds the booking phone, guest breakdown and notes', async () => {
    const { service } = make({
      tickets: [stored()],
      bookings: [
        {
          id: 'b1',
          contactPhone: '0901234567',
          notes: 'Dị ứng hải sản',
          guestPricing: { guests: { adults: 1, children: 1, infants: 0 } },
        },
      ],
    });

    const roster = await service.rosterForGuide(GUIDE, TOUR);

    expect(roster.items[0]).toMatchObject({
      contactPhone: '0901234567',
      notes: 'Dị ứng hải sản',
      guests: { adults: 1, children: 1, infants: 0 },
    });
  });

  it('counts every participant as an adult when the booking has no age pricing', async () => {
    const { service } = make({
      tickets: [stored()],
      bookings: [{ id: 'b1', contactPhone: '0901234567', notes: null, guestPricing: null }],
    });

    const roster = await service.rosterForGuide(GUIDE, TOUR);

    expect(roster.items[0]).toMatchObject({ guests: { adults: 2, children: 0, infants: 0 } });
  });

  it('answers 404 when the guide has not accepted the assignment', async () => {
    const { service } = make({ assigned: false });
    await expect(service.rosterForGuide(GUIDE, TOUR)).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});

describe('checkInForGuide', () => {
  it('stamps usedAt once, keeps the ticket VALID and returns the holder facts', async () => {
    const ticket = stored();
    const { service, db } = make({ tickets: [ticket] });

    const result = await service.checkInForGuide(GUIDE, TOUR, '  etk-aaaaaaaaaaaaaaaa ');

    expect(result).toMatchObject({ ticketId: 'e1', holderName: 'Ann Nguyen', participants: 2, tourTitle: 'Ha Long 3N2Đ' });
    expect(result.checkedInAt).toBe('2026-12-01T08:00:00.000Z');
    expect(db[0]).toMatchObject({ status: 'VALID', usedAt: new Date('2026-12-01T08:00:00Z') });
  });

  it('answers 404 for an unknown code', async () => {
    const { service } = make();
    await expect(service.checkInForGuide(GUIDE, TOUR, 'ETK-ZZZZZZZZZZZZZZZZ')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TICKET_NOT_FOUND',
    });
  });

  it('answers 409 TICKET_WRONG_TOUR without leaking the holder', async () => {
    const { service } = make({ tickets: [stored({ tourId: 'other-tour' })] });
    const error = await service.checkInForGuide(GUIDE, TOUR, 'ETK-AAAAAAAAAAAAAAAA').catch((value) => value);

    expect(error).toMatchObject({ statusCode: 409, code: 'TICKET_WRONG_TOUR' });
    expect(error.details).toBeUndefined();
    expect(error.message).not.toContain('Ann');
  });

  it('answers 409 TICKET_CANCELLED for a cancelled ticket', async () => {
    const { service } = make({ tickets: [stored({ status: 'CANCELLED' })] });
    await expect(service.checkInForGuide(GUIDE, TOUR, 'ETK-AAAAAAAAAAAAAAAA')).rejects.toMatchObject({
      statusCode: 409,
      code: 'TICKET_CANCELLED',
    });
  });

  it('answers 409 TICKET_ALREADY_USED for a ticket that was already checked in', async () => {
    const { service } = make({ tickets: [stored({ usedAt: new Date('2026-12-01T08:00:00Z') })] });
    await expect(service.checkInForGuide(GUIDE, TOUR, 'ETK-AAAAAAAAAAAAAAAA')).rejects.toMatchObject({
      statusCode: 409,
      code: 'TICKET_ALREADY_USED',
    });
  });

  it('answers 409 TICKET_ALREADY_USED for a ticket whose trip already completed', async () => {
    const { service } = make({ tickets: [stored({ status: 'USED', usedAt: new Date('2026-12-02T00:00:00Z') })] });
    await expect(service.checkInForGuide(GUIDE, TOUR, 'ETK-AAAAAAAAAAAAAAAA')).rejects.toMatchObject({
      statusCode: 409,
      code: 'TICKET_ALREADY_USED',
    });
  });

  it('re-reads after a lost compare-and-set and answers TICKET_ALREADY_USED', async () => {
    const ticket = stored();
    const { service, repo } = make({ tickets: [ticket] });
    repo.markCheckedIn.mockImplementationOnce(async () => {
      ticket.usedAt = new Date('2026-12-01T08:00:01Z');
      return null;
    });

    await expect(service.checkInForGuide(GUIDE, TOUR, 'ETK-AAAAAAAAAAAAAAAA')).rejects.toMatchObject({
      statusCode: 409,
      code: 'TICKET_ALREADY_USED',
    });
  });

  it('answers CONCURRENT_UPDATE when the ticket changed but is still unchecked', async () => {
    const ticket = stored();
    const { service, repo } = make({ tickets: [ticket] });
    repo.markCheckedIn.mockResolvedValueOnce(null);

    await expect(service.checkInForGuide(GUIDE, TOUR, 'ETK-AAAAAAAAAAAAAAAA')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONCURRENT_UPDATE',
    });
  });

  it('checks the assignment before looking a code up', async () => {
    const { service, repo } = make({ assigned: false });
    await expect(service.checkInForGuide(GUIDE, TOUR, 'ETK-AAAAAAAAAAAAAAAA')).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findByCode).not.toHaveBeenCalled();
  });
});
