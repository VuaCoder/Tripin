import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { bearer, captureMail, createUser, createApprovedTour, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';
import { signAccessToken } from '../../auth/auth.tokens';
import { signOnboardingToken } from '../../auth/onboarding.tokens';
import { decodeMailBody, flushMailOutbox } from '../../notifications/mail-outbox';
import { systemSettingsService } from '../../system-settings/system-settings.service';
import { bookingsService } from '../../bookings/bookings.service';
import { ComplaintsRepository } from '../../complaints/complaints.repository';
import { reportsRepository } from '../../reports/reports.repository';
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';

const app = createApp();
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(async () => { vi.restoreAllMocks(); captureMail(); await resetDatabase(); });
const reason = 'Appeal investigated and accepted';
const fresh = async (id: string) => { const user = await prisma.user.findUniqueOrThrow({ where: { id } }); return signAccessToken(id, user.role, user.tokenVersion); };
const policy = (token: string, key: string, expectedVersion: number, params: Record<string, number> = {}) => request(app).put(`/api/v1/admin/policies/${key}`).set(bearer(token)).send({ title: 'Policy configuration', content: 'Reviewed policy terms', reason, expectedVersion, params });

describe('KIEU security and workflow regressions', () => {
  it('rejects email-only agency reads/writes/status, including attempts to mint an onboarding token', async () => {
    const agency = await createUser('AGENCY', 'agency@test.example', { agencyProfile: { verificationStatus: 'REJECTED', companyName: 'Private company', licenseNumber: 'LIC123' } });
    for (const path of ['application', 'application-status']) expect((await request(app).get(`/api/v1/auth/agency/${path}?email=agency@test.example`)).status).toBe(401);
    const body = { email: 'agency@test.example', fullName: 'Other person', phone: '0912345678', companyName: 'Changed company', licenseNumber: 'LIC456', address: 'Address 123' };
    expect((await request(app).put('/api/v1/auth/agency/application').send(body)).status).toBe(401);
    const token = signOnboardingToken('agency@test.example', 0);
    expect((await request(app).get(`/api/v1/auth/agency/application?token=${token}`)).status).toBe(200);
    const other = await createUser('AGENCY', 'other@test.example', { agencyProfile: { companyName: 'Own company' } });
    const owned = await request(app).get('/api/v1/auth/agency/application?email=agency@test.example').set(bearer(other.token));
    expect(owned.body.data.id).toBe(other.id);
    expect(owned.body.data.id).not.toBe(agency.id);
  });

  it('requires Super Admin and reason for unban, revokes old access and every refresh family', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example');
    const mod = await createUser('MODERATOR', 'mod@test.example');
    const user = await createUser('TRAVELER', 'user@test.example');
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: 'test', family: randomUUID(), expiresAt: new Date(Date.now() + 86400000) } });
    expect((await request(app).post(`/api/v1/moderation/users/${user.id}/ban`).set(bearer(mod.token)).send({ reason })).status).toBe(200);
    const unban = (token: string, body: object) => request(app).post(`/api/v1/moderation/users/${user.id}/unban`).set(bearer(token)).send(body);
    expect((await unban(mod.token, { reason })).status).toBe(403);
    expect((await unban(admin.token, {})).status).toBe(400);
    expect((await unban(admin.token, { reason: '         ' })).status).toBe(400);
    expect((await unban(admin.token, { reason })).status).toBe(200);
    expect((await request(app).get('/api/v1/users/me').set(bearer(user.token))).status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    expect((await request(app).get('/api/v1/users/me').set(bearer(await fresh(user.id)))).status).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'user.unbanned' } });
    expect(audit.metadata).toMatchObject({ before: { status: 'BANNED' }, after: { status: 'ACTIVE' }, reason });
  });

  it('rolls back account status and token revocation when audit insert fails', async () => {
    const mod = await createUser('MODERATOR', 'mod@test.example'); const user = await createUser('TRAVELER', 'user@test.example');
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD CONSTRAINT reject_test_audit CHECK (action <> 'user.banned')`);
    try {
      expect((await request(app).post(`/api/v1/moderation/users/${user.id}/ban`).set(bearer(mod.token)).send({ reason })).status).toBe(500);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ status: 'ACTIVE', tokenVersion: 0 });
      expect(await prisma.auditLog.count()).toBe(0);
    } finally { await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" DROP CONSTRAINT reject_test_audit'); }
  });

  it('requires verified email for promotion and prevents ordinary bans on staff', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example'); const user = await createUser('TRAVELER', 'user@test.example', { emailVerifiedAt: null });
    const access = () => request(app).patch(`/api/v1/admin/users/${user.id}/access`).set(bearer(admin.token)).send({ role: 'MODERATOR' });
    expect((await access()).status).toBe(400);
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    expect((await access()).status).toBe(200);
    expect((await request(app).post(`/api/v1/moderation/users/${user.id}/ban`).set(bearer(admin.token)).send({ reason })).status).toBe(400);
    expect((await request(app).post(`/api/v1/admin/staff/${user.id}/disable`).set(bearer(admin.token)).send({ reason })).status).toBe(200);
    expect((await request(app).get('/api/v1/users/me').set(bearer(await fresh(user.id)))).status).toBe(403);
  });

  it('preserves at least one active Super Admin under concurrent demotion', async () => {
    const a = await createUser('SUPER_ADMIN', 'a@test.example', { emailVerifiedAt: new Date() });
    const b = await createUser('SUPER_ADMIN', 'b@test.example', { emailVerifiedAt: new Date() });
    const results = await Promise.all([
      request(app).patch(`/api/v1/admin/users/${b.id}/access`).set(bearer(a.token)).send({ role: 'MODERATOR' }),
      request(app).patch(`/api/v1/admin/users/${a.id}/access`).set(bearer(b.token)).send({ role: 'MODERATOR' }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', staffStatus: 'ACTIVE' } })).toBe(1);
  });

  it('consumes a staff invitation exactly once and never allows a disabled staff session', async () => {
    const mail = captureMail(); const admin = await createUser('SUPER_ADMIN', 'admin@test.example');
    const invited = await request(app).post('/api/v1/admin/staff/invite').set(bearer(admin.token)).send({ email: 'staff@test.example', fullName: 'Invited Staff' });
    expect(invited.status).toBe(201);
    await flushMailOutbox();
    const outbox = await prisma.mailOutbox.findFirstOrThrow({ where: { recipient: 'staff@test.example' } });
    const token = /token=([a-f0-9]+)/.exec(decodeMailBody(outbox.text))![1]!;
    expect(outbox.text).not.toContain(token);
    expect(await prisma.staffInvitation.findFirstOrThrow()).toMatchObject({ consumedAt: null });
    const activate = () => request(app).post('/api/v1/auth/staff/activate').send({ token, password: 'SecurePassw0rd!' });
    expect((await activate()).status).toBe(200); expect((await activate()).status).toBe(400);
    expect(mail.outbox.some((m) => m.to === 'staff@test.example')).toBe(true);
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'staff@test.example', password: 'SecurePassw0rd!' });
    expect(login.status).toBe(200);
    await request(app).post(`/api/v1/admin/staff/${invited.body.data.id}/disable`).set(bearer(admin.token)).send({ reason });
    expect((await request(app).get('/api/v1/users/me').set(bearer(login.body.data.accessToken))).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'staff@test.example', password: 'SecurePassw0rd!' })).status).toBe(403);
  });

  it('reinviting expires every previous link and enforces the new expiration', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example');
    const response = await request(app).post('/api/v1/admin/staff/invite').set(bearer(admin.token)).send({ email: 'staff@test.example', fullName: 'Invited Staff' });
    const oldMail = await prisma.mailOutbox.findFirstOrThrow({ where: { recipient: 'staff@test.example' } });
    const oldToken = /token=([a-f0-9]+)/.exec(decodeMailBody(oldMail.text))![1]!;
    expect((await request(app).post(`/api/v1/admin/staff/${response.body.data.id}/reinvite`).set(bearer(admin.token)).send({})).status).toBe(200);
    expect(await prisma.staffInvitation.count({ where: { userId: response.body.data.id, consumedAt: null } })).toBe(1);
    expect((await request(app).post('/api/v1/auth/staff/activate').send({ token: oldToken, password: 'SecurePassw0rd!' })).status).toBe(400);
    const newMail = await prisma.mailOutbox.findFirstOrThrow({ where: { recipient: 'staff@test.example', id: { not: oldMail.id } } });
    const token = /token=([a-f0-9]+)/.exec(decodeMailBody(newMail.text))![1]!;
    await prisma.staffInvitation.updateMany({ where: { userId: response.body.data.id, consumedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post('/api/v1/auth/staff/activate').send({ token, password: 'SecurePassw0rd!' })).status).toBe(400);
  });

  it('applies revokes to API permissions and dashboard payloads across cache boundaries', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example'); const mod = await createUser('MODERATOR', 'mod@test.example');
    expect((await request(app).get('/api/v1/moderation/dashboard').set(bearer(admin.token))).body.data.queues).toHaveProperty('reportsOpen');
    await prisma.user.update({ where: { id: mod.id }, data: { revokedPermissions: ['dispute:resolve', 'complaint:handle', 'agency:verify', 'review:moderate'] } });
    expect((await request(app).get('/api/v1/moderation/reports').set(bearer(mod.token))).status).toBe(403);
    const response = await request(app).get('/api/v1/moderation/dashboard').set(bearer(mod.token));
    expect(response.status).toBe(200); expect(response.body.data.queues).not.toHaveProperty('reportsOpen'); expect(response.body.data.queues).not.toHaveProperty('supportTicketsOpen');
    expect((await request(app).get('/api/v1/users/me').set(bearer(mod.token))).body.data).not.toHaveProperty('revokedPermissions');
  });

  it('protects verified identity while allowing website and avatar clearing', async () => {
    const agency = await createUser('AGENCY', 'agency@test.example', { avatarUrl: 'https://example.com/avatar.jpg', agencyProfile: { companyName: 'Verified company', licenseNumber: 'LIC123', verificationStatus: 'VERIFIED', website: 'https://example.com' } });
    expect((await request(app).patch('/api/v1/users/me').set(bearer(agency.token)).send({ agencyProfile: { companyName: 'Different legal entity' } })).status).toBe(409);
    expect((await request(app).patch('/api/v1/users/me').set(bearer(agency.token)).send({ agencyProfile: { website: '' } })).status).toBe(200);
    expect((await request(app).delete('/api/v1/users/me/avatar').set(bearer(agency.token))).status).toBe(200);
    expect(await prisma.agencyProfile.findUniqueOrThrow({ where: { userId: agency.id } })).toMatchObject({ website: null, verificationStatus: 'VERIFIED', companyName: 'Verified company' });
  });

  it('supports information requested and FIFO submission ordering', async () => {
    const mod = await createUser('MODERATOR', 'mod@test.example');
    const first = await createUser('AGENCY', 'first@test.example', { agencyProfile: { verificationStatus: 'PENDING', submittedAt: new Date('2026-01-01'), companyName: 'First company' } });
    const second = await createUser('AGENCY', 'second@test.example', { agencyProfile: { verificationStatus: 'PENDING', submittedAt: new Date('2026-01-02') } });
    const list = await request(app).get('/api/v1/moderation/agencies').set(bearer(mod.token));
    expect(list.body.data.map((u: { id: string }) => u.id)).toEqual([first.id, second.id]);
    expect((await request(app).post(`/api/v1/moderation/agencies/${first.id}/verify`).set(bearer(mod.token)).send({ approve: false, requestInformation: true, note: 'Please upload a clear business license' })).status).toBe(200);
    const token = signOnboardingToken('first@test.example', 0);
    const resubmit = await request(app).put('/api/v1/auth/agency/application').send({ token, fullName: 'First Owner', companyName: 'First company', licenseNumber: 'LIC123', phone: '0912345678', address: 'Business address 123' });
    expect(resubmit.status).toBe(200);
    expect(await prisma.agencyProfile.findUniqueOrThrow({ where: { userId: first.id } })).toMatchObject({ verificationStatus: 'PENDING', submissionDateEstimated: false });
  });

  it('versions policies, rejects stale saves, and rollback appends a new immutable version', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example');
    expect((await policy(admin.token, 'cancellation', 0, { cancellationWindowHours: 24 })).status).toBe(200);
    expect((await policy(admin.token, 'cancellation', 0, { cancellationWindowHours: 48 })).status).toBe(409);
    expect((await policy(admin.token, 'cancellation', 1, { cancellationWindowHours: 48 })).status).toBe(200);
    const history = await request(app).get('/api/v1/admin/policies/cancellation/history').set(bearer(admin.token));
    const original = history.body.data.find((v: { versionNumber: number }) => v.versionNumber === 1);
    const rollback = await request(app).post('/api/v1/admin/policies/cancellation/rollback').set(bearer(admin.token)).send({ versionId: original.id, expectedVersion: 2, reason });
    expect(rollback.status).toBe(200); expect(rollback.body.data.version).toBe(3);
    expect(rollback.body.data.params.cancellationWindowHours).toBe(24);
    expect((await prisma.policyVersion.findUniqueOrThrow({ where: { id: original.id } })).versionNumber).toBe(1);
  });

  it('keeps the booking cancellation snapshot when policy changes', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example'); const traveler = await createUser('TRAVELER', 'traveler@test.example'); const agency = await createUser('AGENCY', 'agency@test.example');
    const tour = await createApprovedTour(agency.id, { daysAhead: 1.25 });
    const actor = { userId: admin.id, role: 'SUPER_ADMIN' as const };
    await systemSettingsService.setPolicy(actor, 'cancellation', { title: 'Cancel', content: '', params: { cancellationWindowHours: 24 } });
    const booking = await bookingsService.createBooking(traveler.id, { tourId: tour.tourId, departureId: tour.departureId, participants: 1, contact: { fullName: 'Traveler', phone: '0912345678' } });
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED', isPaid: true } });
    await systemSettingsService.setPolicy(actor, 'cancellation', { title: 'Cancel', content: '', expectedVersion: 1, params: { cancellationWindowHours: 48 } });
    expect((await bookingsService.cancelMine(traveler.id, booking.id)).status).toBe('CANCELLED');
  });

  it('requires claim and note on every support resolution path and queues a coded email', async () => {
    const mod = await createUser('MODERATOR', 'mod@test.example'); const other = await createUser('MODERATOR', 'other@test.example'); const user = await createUser('TRAVELER', 'user@test.example'); captureMail();
    const ticket = await prisma.supportTicket.create({ data: { userId: user.id, subject: 'Support needed', category: 'OTHER' } });
    const status = (token: string, body: object) => request(app).patch(`/api/v1/moderation/support-tickets/${ticket.id}/status`).set(bearer(token)).send(body);
    expect((await status(mod.token, { status: 'RESOLVED', resolutionNote: reason })).status).toBe(400);
    const claims = await Promise.all([status(mod.token, { status: 'IN_PROGRESS' }), status(other.token, { status: 'IN_PROGRESS' })]);
    expect(claims.filter((r) => r.status === 200)).toHaveLength(1);
    const current = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } }); const owner = current.assignedToId === mod.id ? mod : other;
    expect((await status(owner.token, { status: 'RESOLVED' })).status).toBe(400);
    expect((await request(app).post(`/api/v1/moderation/support-tickets/${ticket.id}/reply`).set(bearer(owner.token)).send({ text: 'Handled.', resolve: true })).status).toBe(400);
    expect((await status(owner.token, { status: 'RESOLVED', resolutionNote: reason })).status).toBe(200);
    const mail = await prisma.mailOutbox.findFirstOrThrow({ where: { recipient: 'user@test.example' } }); expect(decodeMailBody(mail.text)).toContain(ticket.supportCode);
    expect(ticket.supportCode).toMatch(/^SUP-/);
  });

  it('exports UTF-8 CSV only to Super Admin and neutralizes spreadsheet formulas', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example'); const mod = await createUser('MODERATOR', 'mod@test.example');
    await prisma.auditLog.create({ data: { actorId: admin.id, actorRole: 'SUPER_ADMIN', action: '=SUM(1,2)', targetType: 'setting', metadata: { reason: 'Kiểm tra tiếng Việt' } } });
    expect((await request(app).get('/api/v1/admin/export/audit-logs').set(bearer(mod.token))).status).toBe(403);
    const exported = await request(app).get('/api/v1/admin/export/audit-logs').set(bearer(admin.token));
    expect(exported.status).toBe(200); expect(exported.text).toContain('Kiểm tra tiếng Việt'); expect(exported.text).toContain("'=SUM(1,2)");
  });

  it('snapshots configurable complaint and escalation deadlines and exposes SLA trends', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example');
    const user = await createUser('TRAVELER', 'user@test.example');
    const agency = await createUser('AGENCY', 'agency@test.example');
    expect((await policy(admin.token, 'moderation', 0, { slaHours: 12, escalationSlaHours: 4 })).status).toBe(200);
    const repo = new ComplaintsRepository();
    const before = Date.now();
    const ticket = await repo.create({ ticketCode: 'CP-SLA-TEST', travelerId: user.id, agencyId: agency.id, tourId: randomUUID(), category: 'OTHER', subCategory: 'OTHER_SERVICE_ISSUE', subject: 'Check service quality', description: 'Review the problem', priority: 'NORMAL', initialMessageText: 'Review the problem' });
    expect(ticket.slaHours).toBe(12); expect(ticket.slaPolicyVersion).toBe(1);
    expect(ticket.slaDeadlineAt!.getTime()).toBeGreaterThanOrEqual(before + 12 * 3_600_000);
    expect((await policy(admin.token, 'moderation', 1, { slaHours: 48, escalationSlaHours: 8 })).status).toBe(200);
    const escalation = await repo.updateStatus(ticket.id, ['OPEN'], { status: 'ESCALATED', escalatedAt: new Date() });
    expect(escalation).toMatchObject({ slaHours: 12, escalationSlaHours: 8, escalationPolicyVersion: 2 });
    const chart = await request(app).get('/api/v1/moderation/sla?days=7').set(bearer(admin.token));
    expect(chart.status).toBe(200); expect(chart.body.data.rows).toHaveLength(7);
    expect(chart.body.data.rows.reduce((n: number, row: { onTime: number }) => n + row.onTime, 0)).toBe(1);
    expect((await request(app).get('/api/v1/moderation/sla?days=7').set(bearer(user.token))).status).toBe(403);
  });

  it('records consent to the exact policy version and keeps scheduled versions inactive until their effective date', async () => {
    const admin = await createUser('SUPER_ADMIN', 'admin@test.example'); const user = await createUser('TRAVELER', 'user@test.example');
    const saved = await policy(admin.token, 'terms', 0);
    const id = saved.body.data.policyVersionId;
    expect(id).toBeTruthy();
    const accept = () => request(app).post('/api/v1/policies/accept').set(bearer(user.token)).send({ policyVersionId: id });
    expect((await accept()).status).toBe(200); expect((await accept()).status).toBe(200);
    expect(await prisma.policyAcceptance.count({ where: { userId: user.id } })).toBe(1);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const scheduled = await request(app).put('/api/v1/admin/policies/terms').set(bearer(admin.token)).send({ title: 'Future terms', content: 'Will be effective tomorrow', expectedVersion: 1, effectiveFrom: future, reason });
    expect(scheduled.status).toBe(200); expect(scheduled.body.data.version).toBe(2);
    expect(scheduled.body.data.policyVersionId).toBe(id); expect(scheduled.body.data.title).toBe('Policy configuration');
    await expect(prisma.policyVersion.update({ where: { id }, data: { reason: 'Tampering' } })).rejects.toThrow();
  });

  it('sorts accumulated report counts before pagination and applies combined search/date filters', async () => {
    const mod = await createUser('MODERATOR', 'mod@test.example'); const user = await createUser('TRAVELER', 'user@test.example');
    const many = randomUUID(); const few = randomUUID();
    await prisma.report.createMany({ data: [many, few, many, many].map((targetId, i) => ({ reporterId: user.id, targetType: 'USER', targetId, category: 'OTHER', description: `Searchable violation ${i}`, status: 'OPEN' as const })) });
    const response = await request(app).get('/api/v1/moderation/reports').set(bearer(mod.token)).query({ sort: 'reports_desc', targetType: 'USER', category: 'OTHER', q: 'Searchable', limit: 1, from: new Date(Date.now() - 60_000).toISOString(), to: new Date(Date.now() + 60_000).toISOString() });
    expect(response.status).toBe(200); expect(response.body.meta.total).toBe(4);
    expect(response.body.data[0]).toMatchObject({ targetId: many, totalReportsCount: 3 });
    expect((await request(app).get('/api/v1/moderation/reports?q=absent').set(bearer(mod.token))).body.meta.total).toBe(0);
  });

  it('measures report aggregation on 10000 rows without per-item count queries', async () => {
    const user = await createUser('TRAVELER', 'user@test.example');
    const targets = Array.from({ length: 100 }, () => randomUUID());
    await prisma.report.createMany({ data: Array.from({ length: 10_000 }, (_, i) => ({ reporterId: user.id, targetType: 'USER' as const, targetId: targets[i % targets.length]!, category: 'OTHER' as const, description: `Report ${i}`, status: 'OPEN' as const })) });
    const times: number[] = [];
    for (let i = 0; i < 12; i++) { const started = performance.now(); const result = await reportsRepository.listForModeration({ page: 1, limit: 20, status: 'OPEN', sort: 'reports_desc' }); expect(result.items[0]!.totalReportsCount).toBe(100); if (i >= 2) times.push(performance.now() - started); }
    times.sort((a, b) => a - b);
    const p95 = times[Math.ceil(times.length * .95) - 1]!;
    const plan = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT r.id, counts.total FROM "Report" r JOIN (SELECT "targetType", "targetId", COUNT(*) AS total FROM "Report" GROUP BY "targetType", "targetId") counts ON counts."targetType" = r."targetType" AND counts."targetId" = r."targetId" WHERE r.status = 'OPEN' ORDER BY counts.total DESC, r."createdAt" ASC, r.id ASC LIMIT 20`);
    mkdirSync('../.test-artifacts', { recursive: true });
    writeFileSync('../.test-artifacts/kieu-report-performance.json', JSON.stringify({ rows: 10_000, targets: 100, pageSize: 20, warmup: 2, samples: times, p95Ms: p95, explainAnalyze: plan, environment: 'local test PostgreSQL, repository aggregate query' }, null, 2));
    expect(p95).toBeLessThan(200);
  });
});
