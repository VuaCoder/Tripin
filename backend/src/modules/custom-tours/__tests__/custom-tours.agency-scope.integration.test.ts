import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../../../config/database';
import { createApp } from '../../../app';
import { startDatabase, stopDatabase, createUser, createApprovedTour, bearer } from '../../../test/integration';

const app = createApp();
const scope = (token: string, agencyId: string) => ({ ...bearer(token), 'X-Agency-Id': agencyId });

describe('custom-tours tenant scope (integration)', () => {
  let owner: Awaited<ReturnType<typeof createUser>>;
  let manager: Awaited<ReturnType<typeof createUser>>;
  let staff: Awaited<ReturnType<typeof createUser>>;
  let accountant: Awaited<ReturnType<typeof createUser>>;
  let traveler: Awaited<ReturnType<typeof createUser>>;
  let requestId: string;

  beforeAll(async () => {
    await startDatabase();
    owner = await createUser('AGENCY', 'owner@scope.test', { agencyProfile: { companyName: 'Scope Travel' } });
    manager = await createUser('AGENCY', 'manager@scope.test');
    staff = await createUser('AGENCY', 'staff@scope.test');
    accountant = await createUser('AGENCY', 'accountant@scope.test');
    traveler = await createUser('TRAVELER', 'traveler@scope.test');
    for (const [userId, role] of [[manager.id, 'MANAGER'], [staff.id, 'STAFF'], [accountant.id, 'ACCOUNTANT']] as const) {
      await prisma.agencyMember.create({ data: { agencyId: owner.id, userId, role } });
    }
    const { tourId } = await createApprovedTour(owner.id);
    const created = await request(app).post('/api/v1/custom-tours').set(bearer(traveler.token)).send({ sourceTourId: tourId, participants: 2 });
    expect(created.status).toBe(201);
    requestId = created.body.data.id;
  });
  afterAll(stopDatabase);

  it('lets MANAGER and STAFF read the requests addressed to the selected agency', async () => {
    for (const member of [manager, staff]) {
      const response = await request(app).get('/api/v1/custom-tours').set(scope(member.token, owner.id));
      expect(response.status).toBe(200);
      expect(response.body.data.map((item: { id: string }) => item.id)).toContain(requestId);
      expect((await request(app).get(`/api/v1/custom-tours/${requestId}`).set(scope(member.token, owner.id))).status).toBe(200);
    }
  });

  it('keeps ACCOUNTANT out even though the global AGENCY role grants custom-tour:view', async () => {
    expect((await request(app).get('/api/v1/custom-tours').set(scope(accountant.token, owner.id))).status).toBe(403);
  });

  it('scopes the traveler to their own requests', async () => {
    const response = await request(app).get('/api/v1/custom-tours').set(bearer(traveler.token));
    expect(response.status).toBe(200);
    expect(response.body.data.map((item: { id: string }) => item.id)).toContain(requestId);
  });
});
