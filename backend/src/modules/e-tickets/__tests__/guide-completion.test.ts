import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findById: vi.fn(), transition: vi.fn(), emitCompleted: vi.fn() }));
vi.mock('../../bookings/bookings.repository', () => ({ bookingsRepository: mocks }));
vi.mock('../../bookings/bookings.events', () => ({ bookingEvents: { emitCompleted: mocks.emitCompleted } }));
import { ETicketsService } from '../e-tickets.service';

beforeEach(() => vi.clearAllMocks());
const booking = (id: string, departureId: string, ended: boolean) => ({
  id, departureId, tourId: 'tour', status: 'CONFIRMED', travelerId: 'traveler',
  contact: { fullName: 'Guest' }, endDate: new Date(Date.now() + (ended ? -1 : 1) * 86_400_000),
});

function make(bookings: ReturnType<typeof booking>[]) {
  mocks.findById.mockImplementation(async (id: string) => bookings.find((b) => b.id === id));
  mocks.transition.mockImplementation(async (id: string) => ({ ...bookings.find((b) => b.id === id), status: 'COMPLETED' }));
  const tickets = {
    findAcceptedAssignment: vi.fn(async () => ({ tour: { title: 'Tour' } })),
    listByTour: vi.fn(async () => bookings.map((b) => ({ bookingId: b.id }))),
  };
  return new ETicketsService(tickets as never, { notify: vi.fn() });
}

describe('guide completion scope (BOOK-012)', () => {
  it('rejects a future departure without transitions or events', async () => {
    await expect(make([booking('b1', 'd1', false)]).completeTripForGuide('guide', 'tour')).rejects.toMatchObject({ code: 'TRIP_NOT_ENDED' });
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(mocks.emitCompleted).not.toHaveBeenCalled();
  });
  it('does not complete future departures of the same tour', async () => {
    expect(await make([booking('b1', 'd1', true), booking('b2', 'd2', false)]).completeTripForGuide('guide', 'tour')).toEqual({ completedCount: 1 });
    expect(mocks.transition).toHaveBeenCalledTimes(1);
    expect(mocks.transition.mock.calls[0]?.[0]).toBe('b1');
  });
  it('requires an explicit choice when several ended departures exist', async () => {
    const service = make([booking('b1', 'd1', true), booking('b2', 'd2', true)]);
    await expect(service.completeTripForGuide('guide', 'tour')).rejects.toMatchObject({ code: 'DEPARTURE_REQUIRED' });
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(await service.completeTripForGuide('guide', 'tour', 'd2')).toEqual({ completedCount: 1 });
    expect(mocks.transition.mock.calls[0]?.[0]).toBe('b2');
  });
});
