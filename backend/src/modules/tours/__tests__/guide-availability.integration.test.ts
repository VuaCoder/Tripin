import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../config/database';
import { createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { toursRepository } from '../tours.repository';

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

async function fixture() {
  const agency = await createUser('AGENCY', 'agency@availability.test');
  const guide = await createUser('TOUR_GUIDE', 'guide@availability.test');
  const first = await createApprovedTour(agency.id);
  const second = await createApprovedTour(agency.id);
  const date = new Date('2030-01-01T00:00:00Z');
  await prisma.tourDeparture.updateMany({ data: { date } });
  await prisma.tourGuideAssignment.createMany({ data: [first, second].map(({ tourId }) => ({ tourId, guideId: guide.id, feePerBooking: 100, status: 'PENDING' })) });
  return { first, second, guide, date };
}

const accept = (tourId: string, guideId: string) => toursRepository.answerGuideAssignment(tourId, guideId, { status: 'ACCEPTED', respondedAt: new Date() });

describe('guide schedule collision (GUIDE-002)', () => {
  it('serializes concurrent acceptance so only one overlapping tour is accepted', async () => {
    const { first, second, guide } = await fixture();
    const results = await Promise.allSettled([accept(first.tourId, guide.id), accept(second.tourId, guide.id)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const loser = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(loser.reason).toMatchObject({ code: 'GUIDE_SCHEDULE_CONFLICT' });
    expect(await prisma.tourGuideAssignment.count({ where: { status: 'ACCEPTED' } })).toBe(1);
  });

  it('allows adjacent departures and multiple bookings of the same departure', async () => {
    const { first, second, guide, date } = await fixture();
    await prisma.tourDeparture.update({ where: { id: second.departureId }, data: { date: new Date(date.getTime() + 2 * 86_400_000) } });
    await accept(first.tourId, guide.id);
    await accept(second.tourId, guide.id);
    expect(await toursRepository.reserveSeats(first.tourId, first.departureId, 1)).toBe(true);
    expect(await toursRepository.reserveSeats(first.tourId, first.departureId, 1)).toBe(true);
  });

  it('blocks booking when legacy accepted assignments overlap without consuming seats', async () => {
    const { first } = await fixture();
    await prisma.tourGuideAssignment.updateMany({ data: { status: 'ACCEPTED' } });
    await expect(toursRepository.reserveSeats(first.tourId, first.departureId, 1)).rejects.toMatchObject({ code: 'GUIDE_SCHEDULE_CONFLICT' });
    expect(await prisma.tourDeparture.findUnique({ where: { id: first.departureId } })).toMatchObject({ remaining: 10 });
  });

  it('also blocks booking a pending assignment when its guide already accepted an overlapping tour', async () => {
    const { first, second, guide } = await fixture();
    await accept(first.tourId, guide.id);
    await expect(toursRepository.reserveSeats(second.tourId, second.departureId, 1)).rejects.toMatchObject({ code: 'GUIDE_SCHEDULE_CONFLICT' });
    expect(await prisma.tourDeparture.findUnique({ where: { id: second.departureId } })).toMatchObject({ remaining: 10 });
  });

  it('rolls back a duration edit that creates an overlap', async () => {
    const { first, second, guide, date } = await fixture();
    await prisma.tourDeparture.update({ where: { id: second.departureId }, data: { date: new Date(date.getTime() + 2 * 86_400_000) } });
    await accept(first.tourId, guide.id);
    await accept(second.tourId, guide.id);
    await expect(toursRepository.updateIfStatus(first.tourId, ['APPROVED'], { durationDays: 3 })).rejects.toMatchObject({ code: 'GUIDE_SCHEDULE_CONFLICT' });
    expect(await prisma.tour.findUnique({ where: { id: first.tourId } })).toMatchObject({ durationDays: 2 });
  });
});
