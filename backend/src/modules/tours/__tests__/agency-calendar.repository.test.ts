import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../config/database';
import { agencyCalendarRepository } from '../agency-calendar.repository';

vi.mock('../../../config/database', () => {
  return {
    prisma: {
      $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
      $queryRaw: vi.fn(),
      tourDeparture: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe('agencyCalendarRepository unit tests', () => {
  const agencyId = '11111111-1111-1111-1111-111111111111';
  const tourId = '22222222-2222-2222-2222-222222222222';
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const futureDate2 = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

  const mockTour = {
    id: tourId,
    agencyId,
    title: 'Tour Test',
    durationDays: 3,
    basePrice: 1000000n,
    images: ['https://example.com/cover.jpg'],
    status: 'PUBLISHED',
    maxGroupSize: 20,
    agePricing: null,
  };

  it('skips duplicate departures on create and creates new future departures', async () => {
    const existingDeparture = {
      id: 'dep-1',
      tourId,
      date: futureDate,
      capacity: 20,
      remaining: 20,
      priceOverride: null,
      isOpen: true,
    };

    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([mockTour]) // tour
      .mockResolvedValueOnce([existingDeparture]); // departures

    (prisma.tourDeparture.findMany as any).mockResolvedValue([]);
    (prisma.tourDeparture.create as any).mockImplementation(async ({ data }: any) => ({
      ...data,
      id: data.id || 'dep-new',
    }));

    const result = await agencyCalendarRepository.create(agencyId, tourId, [
      { id: 'req-dup', date: futureDate, capacity: 20 },
      { id: 'req-new', date: futureDate2, capacity: 15 },
    ]);

    expect(result.skipped).toBe(1);
    expect(result.created).toBe(1);
    expect(result.events).toHaveLength(2);
  });

  it('blocks moving or rescheduling a departure that already has bookings', async () => {
    const bookedDeparture = {
      id: 'dep-booked',
      tourId,
      date: futureDate,
      capacity: 20,
      remaining: 15, // 5 booked
      priceOverride: null,
      isOpen: true,
    };

    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([mockTour])
      .mockResolvedValueOnce([bookedDeparture]);

    await expect(
      agencyCalendarRepository.update(agencyId, tourId, 'dep-booked', {
        expectedDate: futureDate,
        date: futureDate2,
      }),
    ).rejects.toMatchObject({
      code: 'DEPARTURE_HAS_BOOKINGS',
    });
  });

  it('blocks reducing capacity below already booked customer count', async () => {
    const bookedDeparture = {
      id: 'dep-booked',
      tourId,
      date: futureDate,
      capacity: 20,
      remaining: 15, // 5 booked
      priceOverride: null,
      isOpen: true,
    };

    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([mockTour])
      .mockResolvedValueOnce([bookedDeparture]);

    await expect(
      agencyCalendarRepository.update(agencyId, tourId, 'dep-booked', {
        expectedDate: futureDate,
        capacity: 4, // less than 5 booked
      }),
    ).rejects.toMatchObject({
      code: 'CAPACITY_BELOW_BOOKED',
    });
  });

  it('blocks deleting a departure that already has bookings', async () => {
    const bookedDeparture = {
      id: 'dep-booked',
      tourId,
      date: futureDate,
      capacity: 20,
      remaining: 18, // 2 booked
      priceOverride: null,
      isOpen: true,
    };

    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([mockTour])
      .mockResolvedValueOnce([bookedDeparture]);

    await expect(
      agencyCalendarRepository.remove(agencyId, tourId, 'dep-booked', futureDate),
    ).rejects.toMatchObject({
      code: 'DEPARTURE_HAS_BOOKINGS',
    });
  });

  it('deletes an unbooked departure cleanly', async () => {
    const unbookedDeparture = {
      id: 'dep-free',
      tourId,
      date: futureDate,
      capacity: 20,
      remaining: 20, // 0 booked
      priceOverride: null,
      isOpen: true,
    };

    (prisma.$queryRaw as any)
      .mockResolvedValueOnce([mockTour])
      .mockResolvedValueOnce([unbookedDeparture]);
    (prisma.tourDeparture.delete as any).mockResolvedValue(unbookedDeparture);

    await expect(
      agencyCalendarRepository.remove(agencyId, tourId, 'dep-free', futureDate),
    ).resolves.toBeUndefined();
    expect(prisma.tourDeparture.delete).toHaveBeenCalledWith({ where: { id: 'dep-free' } });
  });
});
