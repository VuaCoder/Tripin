import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { BookingModel } from '../../bookings/bookings.model';
import { PaymentModel } from '../../payments/payments.model';
import { ReportModel } from '../../reports/reports.model';
import { ReviewModel } from '../../reviews/reviews.model';
import { SubscriptionModel } from '../../subscriptions/subscriptions.model';
import { SupportTicketModel } from '../../support/support.model';
import { TourModel } from '../../tours/tours.model';
import { UserModel } from '../../users/users.model';
import { bearer, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

// Real Express app + real MongoDB: every dashboard number is compared with rows that this test inserted itself.
// (The dashboards cache their answer for 30 s, so each test builds its data first and reads each dashboard once.)
const app = createApp();

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

const DAY = 86_400_000;
const oid = () => new Types.ObjectId();
let sequence = 0;

interface BookingSeed {
  agencyId: string;
  tourId: string;
  title: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  total: number;
  commission: number;
  confirmedDaysAgo?: number;
}
const seedBooking = (b: BookingSeed) =>
  BookingModel.create({
    bookingCode: `TRP-TEST${String((sequence += 1)).padStart(4, '0')}`,
    travelerId: oid(),
    agencyId: b.agencyId,
    tourId: b.tourId,
    departureId: oid(),
    tourTitle: b.title,
    departureDate: new Date(Date.now() + 10 * DAY),
    endDate: new Date(Date.now() + 12 * DAY),
    participants: 1,
    contact: { fullName: 'Nguyen Van A', phone: '0901234567' },
    unitPrice: b.total,
    subtotal: b.total,
    totalAmount: b.total,
    commissionBps: 1000,
    commissionAmount: b.commission,
    agencyAmount: b.total - b.commission,
    status: b.status,
    isPaid: b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'CANCELLED',
    ...(b.confirmedDaysAgo !== undefined ? { confirmedAt: new Date(Date.now() - b.confirmedDaysAgo * DAY) } : {}),
  });

const seedReport = (agencyId: string, status: 'OPEN' | 'AGENCY_RESPONDED' | 'RESOLVED') =>
  ReportModel.create({ reporterId: oid(), targetType: 'TOUR', targetId: oid(), category: 'OTHER', description: 'Something is wrong here.', agencyId, status });

const get = (path: string, token: string) => request(app).get(path).set(bearer(token));

describe('agency dashboard', () => {
  it("shows exactly the agency's own figures and nobody else's", async () => {
    const agency = await createUser('AGENCY', 'agency@example.com');
    const rival = await createUser('AGENCY', 'rival@example.com');
    const t1 = await createApprovedTour(agency.id);
    const t2 = await createApprovedTour(agency.id);
    await TourModel.create({ agencyId: agency.id, title: 'Draft one', destination: 'Hue', durationDays: 1, basePrice: 1, status: 'DRAFT' });
    await TourModel.create({ agencyId: agency.id, title: 'Pending one', destination: 'Hue', durationDays: 1, basePrice: 1, status: 'PENDING_REVIEW' });
    const rivalTour = await createApprovedTour(rival.id);

    const base = { agencyId: agency.id };
    await seedBooking({ ...base, tourId: t1.tourId, title: 'T1', status: 'CONFIRMED', total: 1_000_000, commission: 100_000, confirmedDaysAgo: 0 });
    await seedBooking({ ...base, tourId: t1.tourId, title: 'T1', status: 'COMPLETED', total: 2_000_000, commission: 200_000, confirmedDaysAgo: 10 });
    await seedBooking({ ...base, tourId: t2.tourId, title: 'T2', status: 'CONFIRMED', total: 500_000, commission: 50_000, confirmedDaysAgo: 40 });
    await seedBooking({ ...base, tourId: t2.tourId, title: 'T2', status: 'PENDING', total: 700_000, commission: 70_000 });
    await seedBooking({ ...base, tourId: t2.tourId, title: 'T2', status: 'CANCELLED', total: 900_000, commission: 90_000, confirmedDaysAgo: 5 });
    await seedBooking({ agencyId: rival.id, tourId: rivalTour.tourId, title: 'R', status: 'CONFIRMED', total: 3_000_000, commission: 300_000, confirmedDaysAgo: 1 });

    await seedReport(agency.id, 'OPEN');
    await seedReport(agency.id, 'OPEN');
    await seedReport(agency.id, 'AGENCY_RESPONDED');
    await seedReport(rival.id, 'OPEN');

    const res = await get('/api/v1/agency/dashboard', agency.token);
    expect(res.status).toBe(200);
    const d = res.body.data;

    expect(d.tours.total).toBe(4);
    expect(d.tours.byStatus).toMatchObject({ APPROVED: 2, DRAFT: 1, PENDING_REVIEW: 1 });
    expect(d.bookings).toMatchObject({ CONFIRMED: 2, COMPLETED: 1, PENDING: 1, CANCELLED: 1 });
    // Only CONFIRMED + COMPLETED count as revenue; the paid-then-cancelled booking is not income.
    expect(d.revenue).toEqual({ bookings: 3, gross: 3_500_000, commission: 350_000, net: 3_150_000 });
    expect(d.last30Days.map((row: { net: number }) => row.net).sort((a: number, b: number) => a - b)).toEqual([900_000, 1_800_000]);
    expect(d.last30Days.reduce((sum: number, row: { bookings: number }) => sum + row.bookings, 0)).toBe(2); // the 40-day-old sale is outside the window
    expect(d.topTours[0]).toMatchObject({ tourId: t1.tourId, bookings: 2, net: 2_700_000 });
    expect(d.topTours[1]).toMatchObject({ tourId: t2.tourId, bookings: 1, net: 450_000 });
    expect(d.openComplaints).toBe(2); // only OPEN ones of THIS agency wait for its answer
    expect(JSON.stringify(d)).not.toContain(rivalTour.tourId);

    const rivalView = await get('/api/v1/agency/dashboard', rival.token);
    expect(rivalView.body.data.revenue).toEqual({ bookings: 1, gross: 3_000_000, commission: 300_000, net: 2_700_000 });
    expect(rivalView.body.data.openComplaints).toBe(1);
  });

  it('is empty (not an error) for a new agency, and closed to everyone else', async () => {
    const agency = await createUser('AGENCY', 'new@example.com');
    const empty = await get('/api/v1/agency/dashboard', agency.token);
    expect(empty.status).toBe(200);
    expect(empty.body.data.revenue).toEqual({ bookings: 0, gross: 0, commission: 0, net: 0 });
    expect(empty.body.data.topTours).toEqual([]);

    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    expect((await get('/api/v1/agency/dashboard', traveler.token)).status).toBe(403);
    expect((await get('/api/v1/agency/dashboard', moderator.token)).status).toBe(403);
    expect((await request(app).get('/api/v1/agency/dashboard')).status).toBe(401);
  });
});

describe('moderation dashboard', () => {
  it('counts exactly the work waiting for a human', async () => {
    const moderator = await createUser('MODERATOR', 'mod@example.com');
    const agency = await createUser('AGENCY', 'agency@example.com', { agencyProfile: { companyName: 'A', verificationStatus: 'PENDING' } });
    await createUser('AGENCY', 'verified@example.com', { agencyProfile: { companyName: 'B', verificationStatus: 'VERIFIED' } });
    await createUser('AGENCY', 'pending2@example.com', { agencyProfile: { companyName: 'C', verificationStatus: 'PENDING' } });
    await createApprovedTour(agency.id);
    for (let i = 0; i < 3; i += 1) {
      await TourModel.create({ agencyId: agency.id, title: `Waiting ${i}`, destination: 'Hue', durationDays: 1, basePrice: 1, status: 'PENDING_REVIEW' });
    }

    await seedReport(agency.id, 'OPEN');
    await seedReport(agency.id, 'OPEN');
    await seedReport(agency.id, 'AGENCY_RESPONDED');
    await seedReport(agency.id, 'RESOLVED');

    const ticket = (status: string) =>
      SupportTicketModel.create({ userId: oid(), subject: 'A question here', category: 'OTHER', status: status as never, messages: [], messageCount: 0 });
    await ticket('OPEN');
    await ticket('OPEN');
    await ticket('IN_PROGRESS');
    await ticket('CLOSED');

    const review = (status: 'VISIBLE' | 'HIDDEN') =>
      ReviewModel.create({ bookingId: oid(), tourId: oid(), tourTitle: 'T', agencyId: agency.id, travelerId: oid(), rating: 4, comment: 'Quite good trip overall', status });
    await review('VISIBLE');
    await review('VISIBLE');
    await review('HIDDEN');

    const res = await get('/api/v1/moderation/dashboard', moderator.token);
    expect(res.status).toBe(200);
    expect(res.body.data.queues).toEqual({
      toursPendingReview: 3,
      agenciesPendingVerification: 2,
      reportsOpen: 2,
      reportsAwaitingDecision: 1,
      supportTicketsOpen: 2,
      supportTicketsInProgress: 1,
    });
    expect(res.body.data.tours).toMatchObject({ APPROVED: 1, PENDING_REVIEW: 3 });
    expect(res.body.data.reviews).toEqual({ visible: 2, hidden: 1 });

    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    expect((await get('/api/v1/moderation/dashboard', traveler.token)).status).toBe(403);
    expect((await get('/api/v1/moderation/dashboard', agency.token)).status).toBe(403);
  });
});

describe('admin dashboard', () => {
  it('adds up users, tours, bookings, commission, subscriptions and queues for the whole platform', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@example.com');
    const agencyA = await createUser('AGENCY', 'a@example.com');
    const agencyB = await createUser('AGENCY', 'b@example.com');
    const old = await createUser('TRAVELER', 'old@example.com');
    await UserModel.collection.updateOne({ _id: new Types.ObjectId(old.id) }, { $set: { createdAt: new Date(Date.now() - 90 * DAY) } });
    await createUser('TRAVELER', 'banned@example.com', { status: 'BANNED' });
    await createUser('TOUR_GUIDE', 'guide@example.com');

    const ta = await createApprovedTour(agencyA.id);
    const tb = await createApprovedTour(agencyB.id);
    await seedBooking({ agencyId: agencyA.id, tourId: ta.tourId, title: 'A', status: 'CONFIRMED', total: 1_000_000, commission: 100_000, confirmedDaysAgo: 0 });
    await seedBooking({ agencyId: agencyA.id, tourId: ta.tourId, title: 'A', status: 'COMPLETED', total: 2_000_000, commission: 200_000, confirmedDaysAgo: 0 });
    await seedBooking({ agencyId: agencyB.id, tourId: tb.tourId, title: 'B', status: 'CONFIRMED', total: 3_000_000, commission: 300_000, confirmedDaysAgo: 0 });
    await seedBooking({ agencyId: agencyB.id, tourId: tb.tourId, title: 'B', status: 'PENDING', total: 999_000, commission: 99_900 });
    await seedBooking({ agencyId: agencyB.id, tourId: tb.tourId, title: 'B', status: 'CANCELLED', total: 888_000, commission: 88_800, confirmedDaysAgo: 0 });

    let order = 1_000;
    const pay = (purpose: 'SUBSCRIPTION' | 'BOOKING', status: string, amount: number) =>
      PaymentModel.create({ purpose, userId: oid(), referenceId: oid(), amount, description: 'x', provider: 'PAYOS', providerOrderCode: (order += 1), status: status as never, expiresAt: new Date(Date.now() + DAY) });
    await pay('SUBSCRIPTION', 'PAID', 199_000);
    await pay('SUBSCRIPTION', 'PAID', 99_000);
    await pay('SUBSCRIPTION', 'PENDING', 500_000); // unpaid money is not revenue
    await pay('BOOKING', 'PAID', 7_000_000); // booking payments are not subscription revenue

    const sub = (status: string, endsInDays: number) =>
      SubscriptionModel.create({ userId: oid(), planId: oid(), planCode: 'P', planName: 'P', price: 1, durationDays: 30, status: status as never, startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + endsInDays * DAY) });
    await sub('ACTIVE', 10);
    await sub('ACTIVE', 20);
    await sub('ACTIVE', -1); // ended but not yet swept: not "running"
    await sub('EXPIRED', -5);

    await seedReport(agencyA.id, 'OPEN');
    await seedReport(agencyA.id, 'AGENCY_RESPONDED');
    await seedReport(agencyA.id, 'RESOLVED');
    await SupportTicketModel.create({ userId: oid(), subject: 'Ticket one', category: 'OTHER', status: 'OPEN', messages: [], messageCount: 0 });
    await SupportTicketModel.create({ userId: oid(), subject: 'Ticket two', category: 'OTHER', status: 'IN_PROGRESS', messages: [], messageCount: 0 });
    await SupportTicketModel.create({ userId: oid(), subject: 'Ticket three', category: 'OTHER', status: 'RESOLVED', messages: [], messageCount: 0 });

    const res = await get('/api/v1/admin/dashboard', admin.token);
    expect(res.status).toBe(200);
    const d = res.body.data;

    expect(d.users.total).toBe(6);
    expect(d.users.byRole).toEqual({ SUPER_ADMIN: 1, AGENCY: 2, TRAVELER: 2, TOUR_GUIDE: 1 });
    expect(d.users.byStatus).toEqual({ ACTIVE: 5, BANNED: 1 });
    expect(d.users.newLast30Days).toBe(5); // everybody except the 90-day-old account
    expect(d.tours).toMatchObject({ total: 2, byStatus: { APPROVED: 2 } });
    expect(d.bookings.byStatus).toEqual({ CONFIRMED: 2, COMPLETED: 1, PENDING: 1, CANCELLED: 1 });
    expect(d.revenue).toMatchObject({ bookings: 3, gross: 6_000_000, commission: 600_000, net: 5_400_000 });
    expect(d.revenue.subscriptions).toEqual({ amount: 298_000, count: 2 });
    const thisMonth = new Date().toISOString().slice(0, 7);
    expect(d.monthly).toEqual([{ month: thisMonth, bookings: 3, gross: 6_000_000, commission: 600_000 }]);
    expect(d.subscriptions.active).toBe(2);
    expect(d.moderation).toEqual({ reportsOpen: 2, supportTicketsOpen: 2 });

    const moderator = await createUser('MODERATOR', 'mod@example.com');
    expect((await get('/api/v1/admin/dashboard', moderator.token)).status).toBe(403);
    expect((await get('/api/v1/admin/dashboard', agencyA.token)).status).toBe(403);
  });
});
