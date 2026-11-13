import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, captureMail, createApprovedTour, createUser, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

const app = createApp();
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);

describe('agency complaint membership', () => {
  it('lets active STAFF respond only to tickets in the selected agency', async () => {
    captureMail();
    const agency = await createUser('AGENCY', 'agency@example.com');
    const other = await createUser('AGENCY', 'other@example.com');
    const traveler = await createUser('TRAVELER', 'traveler@example.com');
    const staff = await createUser('TRAVELER', 'staff@example.com');
    await prisma.agencyMember.create({ data: { agencyId: agency.id, userId: staff.id, role: 'STAFF' } });
    const { tourId } = await createApprovedTour(agency.id);
    const ticket = await prisma.complaintTicket.create({ data: {
      ticketCode: 'CMP-STAFF-1', travelerId: traveler.id, agencyId: agency.id, tourId,
      category: 'OTHER', subCategory: 'General', subject: 'Trip issue', description: 'Please help',
    } });
    const base = '/api/v1/agency/complaint-tickets';
    const headers = { ...bearer(staff.token), 'X-Agency-Id': agency.id };
    const list = await request(app).get(base).set(headers);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const reply = await request(app).post(`${base}/${ticket.id}/messages`).set(headers).send({ text: 'We are checking this issue.' });
    expect(reply.status).toBe(201);
    const resolved = await request(app).post(`${base}/${ticket.id}/resolve`).set(headers).send({ solutionSummary: 'We have arranged a replacement.' });
    expect(resolved.status).toBe(200);
    expect((await prisma.complaintTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('RESOLVED');
    expect((await request(app).get(`${base}/${ticket.id}`).set(bearer(other.token))).status).toBe(404);
  });
});
