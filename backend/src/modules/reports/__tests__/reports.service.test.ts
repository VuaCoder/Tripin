import { describe, expect, it, vi } from 'vitest';
import { ROLES } from '@travel-platform/constants';
import { ReportsService } from '../reports.service';

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function stored(over: R = {}): R {
  return {
    id: 'r1',
    reporterId: 'u1',
    targetType: 'TOUR',
    targetId: 't1',
    category: 'MISLEADING_INFO',
    description: 'The photos do not match the hotel',
    status: 'OPEN',
    agencyId: 'a1',
    tourId: 't1',
    createdAt: new Date(),
    ...over,
  };
}

function make(seed: R[] = []) {
  const db = [...seed];
  const repo = {
    create: vi.fn(async (data: R) => {
      const doc = stored({ ...data, id: `r${db.length + 1}`, status: 'OPEN' });
      db.push(doc);
      return doc;
    }),
    findById: vi.fn(async (id: string) => db.find((r) => r.id === id) ?? null),
    findOpenDuplicate: vi.fn(async (reporter: string, type: string, target: string) =>
      db.find((r) => r.reporterId === reporter && r.targetType === type && String(r.targetId) === target && ['OPEN', 'AGENCY_RESPONDED'].includes(r.status)) ?? null,
    ),
    transition: vi.fn(async (id: string, expected: string[], update: R) => {
      const doc = db.find((r) => r.id === id);
      if (!doc || !expected.includes(doc.status)) return null;
      Object.assign(doc, update);
      return doc;
    }),
    listByReporter: vi.fn(async () => ({ items: db, total: db.length })),
    listByAgency: vi.fn(async () => ({ items: db, total: db.length })),
    listForModeration: vi.fn(async () => ({ items: db, total: db.length })),
  };
  const tours = {
    getTourFacts: vi.fn(async (id: string) => (id === 'ghost' ? null : { id, agencyId: 'a1', title: 'x', status: 'APPROVED' })),
    getTitles: vi.fn(async (ids: string[]) => new Map(ids.filter((id) => id !== 'ghost').map((id) => [id, `Tour ${id}`]))),
  };
  const users = {
    getSummaries: vi.fn(async (ids: string[]) =>
      new Map(ids.map((id) => [id, { id, fullName: 'Nguyen Van An', role: id.startsWith('a') ? 'AGENCY' : id.startsWith('g') ? 'TOUR_GUIDE' : 'TRAVELER' }])),
    ),
  };
  const reviews = {
    getFacts: vi.fn(async (id: string) =>
      id === 'ghost'
        ? null
        : { id, tourId: 't1', agencyId: 'a1', travelerId: 'x', status: 'VISIBLE', rating: 5, comment: 'Tuyệt vời', tourTitle: 'Ha Long' },
    ),
  };
  const bookings = { getFacts: vi.fn(async (id: string) => (id === 'ghost' ? null : { id, travelerId: 'u1' })) };
  const notifications = { notify: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  return { service: new ReportsService(repo as never, tours as never, users as never, reviews as never, bookings as never, notifications, audit), repo, tours, users, reviews, bookings, notifications, audit, db };
}

const base = { category: 'MISLEADING_INFO', description: 'The photos do not match the hotel' } as const;
const moderator = { userId: 'm1', role: ROLES.MODERATOR } as const;

describe('createReport', () => {
  it('routes a tour report to the tour\'s agency, derived on the server, and notifies it', async () => {
    const { service, repo, notifications } = make();
    const dto = await service.createReport('u1', { ...base, targetType: 'TOUR', targetId: 't1' });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ reporterId: 'u1', agencyId: 'a1', tourId: 't1' }));
    expect(dto).toMatchObject({ status: 'OPEN', targetType: 'TOUR' });
    expect(notifications.notify).toHaveBeenCalledWith('a1', expect.objectContaining({ type: 'COMPLAINT_RECEIVED' }));
  });

  it('routes an agency account report to that agency, but a guide report to nobody', async () => {
    const agency = make();
    await agency.service.createReport('u1', { ...base, targetType: 'USER', targetId: 'a9' });
    expect(agency.repo.create).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'a9' }));
    const guide = make();
    await guide.service.createReport('u1', { ...base, targetType: 'USER', targetId: 'g9' });
    expect(guide.repo.create.mock.calls[0]![0]).not.toHaveProperty('agencyId');
    expect(guide.notifications.notify).not.toHaveBeenCalled();
  });

  it('rejects reporting an ordinary traveler account and unknown targets', async () => {
    const { service } = make();
    await expect(service.createReport('u1', { ...base, targetType: 'USER', targetId: 'u7' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.createReport('u1', { ...base, targetType: 'TOUR', targetId: 'ghost' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.createReport('u1', { ...base, targetType: 'REVIEW', targetId: 'ghost' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a review report carries its tour but no responsible agency (moderators decide)', async () => {
    const { service, repo } = make();
    await service.createReport('u1', { ...base, targetType: 'REVIEW', targetId: 'rev1' });
    const created = repo.create.mock.calls[0]![0];
    expect(created.tourId).toBe('t1');
    expect(created).not.toHaveProperty('agencyId');
  });

  it('only accepts the reporter\'s own booking as evidence', async () => {
    const { service, bookings } = make();
    await expect(service.createReport('u1', { ...base, targetType: 'TOUR', targetId: 't1', bookingId: 'ghost' })).rejects.toMatchObject({ statusCode: 404 });
    bookings.getFacts.mockResolvedValueOnce({ id: 'b2', travelerId: 'someone-else' } as never);
    await expect(service.createReport('u1', { ...base, targetType: 'TOUR', targetId: 't1', bookingId: 'b2' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('allows one open report per reporter and target', async () => {
    const { service } = make([stored()]);
    await expect(service.createReport('u1', { ...base, targetType: 'TOUR', targetId: 't1' })).rejects.toMatchObject({ code: 'REPORT_ALREADY_OPEN' });
    await expect(service.createReport('u2', { ...base, targetType: 'TOUR', targetId: 't1' })).resolves.toMatchObject({ status: 'OPEN' });
  });
});

describe('reporter access', () => {
  it('hides other people\'s reports behind 404', async () => {
    const { service } = make([stored({ reporterId: 'other' })]);
    await expect(service.getMine('u1', 'r1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('agency complaints', () => {
  it('shows only reports routed to the agency, with a masked reporter name', async () => {
    const { service } = make([stored()]);
    const complaint = await service.getComplaint('a1', 'r1');
    expect(complaint.reporterName).toBe('Nguyen A.');
    expect(JSON.stringify(complaint)).not.toContain('"reporterId"');
    await expect(service.getComplaint('a2', 'r1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(make([stored({ agencyId: undefined })]).service.getComplaint('a1', 'r1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('responds once: OPEN -> AGENCY_RESPONDED, notifying the reporter', async () => {
    const { service, notifications, db } = make([stored()]);
    const dto = await service.respondToComplaint('a1', 'r1', 'We will update the photos.');
    expect(dto.status).toBe('AGENCY_RESPONDED');
    expect(db[0]!.agencyResponse).toMatchObject({ text: 'We will update the photos.', by: 'a1' });
    expect(notifications.notify).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'REPORT_UPDATED' }));
    await expect(service.respondToComplaint('a1', 'r1', 'Second answer')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('cannot respond to a report of another agency or a closed report', async () => {
    await expect(make([stored()]).service.respondToComplaint('a2', 'r1', 'hijack answer')).rejects.toMatchObject({ statusCode: 404 });
    await expect(make([stored({ status: 'RESOLVED' })]).service.respondToComplaint('a1', 'r1', 'too late now')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });
});

describe('moderator resolution', () => {
  it('decides an OPEN or an answered report, audits it and informs reporter (email) and agency', async () => {
    for (const status of ['OPEN', 'AGENCY_RESPONDED']) {
      const { service, db, audit, notifications } = make([stored({ status })]);
      const dto = await service.resolve(moderator, 'r1', { decision: 'RESOLVED', note: 'Photos were replaced' });
      expect(dto.status).toBe('RESOLVED');
      expect(db[0]!.resolution).toMatchObject({ decision: 'RESOLVED', by: 'm1' });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'report.resolved' }));
      expect(notifications.notify).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'REPORT_RESOLVED' }), { email: true });
      expect(notifications.notify).toHaveBeenCalledWith('a1', expect.objectContaining({ type: 'REPORT_UPDATED' }));
    }
  });

  it('can reject an unfounded report, but a closed report cannot be decided again', async () => {
    const { service } = make([stored()]);
    await service.resolve(moderator, 'r1', { decision: 'REJECTED', note: 'No evidence' });
    await expect(service.resolve(moderator, 'r1', { decision: 'RESOLVED', note: 'second try' })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    await expect(make().service.resolve(moderator, 'nope', { decision: 'RESOLVED', note: 'x y z' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('does not notify an agency when none was responsible', async () => {
    const { service, notifications } = make([stored({ agencyId: undefined })]);
    await service.resolve(moderator, 'r1', { decision: 'RESOLVED', note: 'Handled by staff' });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('names the reporter, the responsible agency, the tour and the target instead of leaving ids', async () => {
    const { service } = make([stored()]);
    const dto = await service.getForModeration('r1');
    expect(dto).toMatchObject({
      reporterName: 'Nguyen Van An',
      agencyName: 'Nguyen Van An',
      tourTitle: 'Tour t1',
      targetName: 'Tour t1',
    });
    // The ids stay on the DTO: the ban action of a USER report needs the reported account id.
    expect(dto.reporterId).toBe('u1');
  });

  it('names a reported account by its company, and a reported review by the tour it is about', async () => {
    const { service, users, tours } = make([
      stored({ id: 'r1', targetType: 'USER', targetId: 'a1', tourId: undefined }),
      stored({ id: 'r2', targetType: 'REVIEW', targetId: 'rev1', agencyId: undefined, tourId: 't9' }),
    ]);
    users.getSummaries.mockResolvedValueOnce(
      new Map([
        ['u1', { id: 'u1', fullName: 'Nguyen Van An', role: 'TRAVELER' }],
        ['a1', { id: 'a1', fullName: 'Tran Thi B', companyName: 'Saigon Travel', role: 'AGENCY' }],
      ]) as never,
    );
    const page = await service.listForModeration({ page: 1, limit: 10 });
    expect(page.items[0]).toMatchObject({ targetName: 'Saigon Travel', agencyName: 'Saigon Travel' });
    expect(page.items[1]).toMatchObject({ targetName: 'Tour t9', tourTitle: 'Tour t9' });
    expect(page.items[1]!.agencyName).toBeUndefined();
    expect(tours.getTitles).toHaveBeenCalledWith(['t9']);
  });

  it('carries the reported review itself, so the moderator judges it without hunting for it', async () => {
    const { service } = make([stored({ targetType: 'REVIEW', targetId: 'rev1', agencyId: undefined, tourId: 't1' })]);
    const dto = await service.getForModeration('r1');
    expect(dto.review).toMatchObject({ rating: 5, comment: 'Tuyệt vời', status: 'VISIBLE', authorName: 'Nguyen Van An' });
    expect(dto.review?.hiddenReason).toBeUndefined();
  });

  it('carries no review block for a report that is not about a review', async () => {
    const { service } = make([stored()]);
    expect((await service.getForModeration('r1')).review).toBeUndefined();
  });
});

describe('agency review disputes', () => {
  const dispute = { category: 'INAPPROPRIATE_CONTENT', description: 'Bài đánh giá sai sự thật về đoàn của chúng tôi.' } as const;

  it('files a review dispute through the report pipeline, without routing it back as a complaint', async () => {
    const { service, repo } = make();
    const dto = await service.disputeReview('a1', 'rev1', dispute);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ reporterId: 'a1', targetType: 'REVIEW', targetId: 'rev1', tourId: 't1' }));
    expect(repo.create.mock.calls[0]![0]).not.toHaveProperty('agencyId');
    expect(dto).toMatchObject({ targetType: 'REVIEW', status: 'OPEN' });
  });

  it('only disputes a review of its own tour, once', async () => {
    const { service } = make();
    await expect(service.disputeReview('a2', 'rev1', dispute)).rejects.toMatchObject({ statusCode: 404 }); // another agency's review
    await expect(service.disputeReview('a1', 'ghost', dispute)).rejects.toMatchObject({ statusCode: 404 });
    await service.disputeReview('a1', 'rev1', dispute);
    await expect(service.disputeReview('a1', 'rev1', dispute)).rejects.toMatchObject({ code: 'REPORT_ALREADY_OPEN' });
  });

  it('lists the disputes the agency filed', async () => {
    const { service } = make([stored({ targetType: 'REVIEW', targetId: 'rev1', reporterId: 'a1' })]);
    const page = await service.listDisputes('a1', { page: 1, limit: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ targetType: 'REVIEW' });
  });
});
