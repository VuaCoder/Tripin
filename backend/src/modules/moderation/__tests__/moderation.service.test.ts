import { describe, expect, it, vi } from 'vitest';
import { ROLES } from '@travel-platform/constants';
import { ModerationService } from '../moderation.service';

const moderator = { userId: 'm1', role: ROLES.MODERATOR } as const;

function make() {
  const tours = { listForModeration: vi.fn(async () => 'tours'), getForModeration: vi.fn(async () => 'tour'), decideReview: vi.fn(async () => 'decided'), suspendTour: vi.fn(async () => 'suspended') };
  const users = {
    listAgenciesByVerification: vi.fn(async () => 'agencies'),
    decideAgencyVerification: vi.fn(async () => 'agency'),
    banUser: vi.fn(async () => 'banned'),
    unbanUser: vi.fn(async () => 'unbanned'),
  };
  const reviews = { listForModeration: vi.fn(async () => 'reviews'), moderate: vi.fn(async () => 'moderated') };
  const reports = { listForModeration: vi.fn(async () => 'reports'), getForModeration: vi.fn(async () => 'report'), resolve: vi.fn(async () => 'resolved') };
  const support = { listForModeration: vi.fn(async () => 'tickets'), getForModeration: vi.fn(async () => 'ticket'), replyAsStaff: vi.fn(async () => 'replied'), setStatus: vi.fn(async () => 'status') };
  const notifications = { notify: vi.fn(async () => undefined) };
  const service = new ModerationService(tours as never, users as never, reviews as never, reports as never, support as never, notifications);
  return { service, tours, users, reviews, reports, support, notifications };
}

describe('ModerationService delegates every use case to the owning module with the acting staff member', () => {
  it('tours', async () => {
    const { service, tours } = make();
    await service.listTours({ status: 'PENDING_REVIEW' }, { page: 1, limit: 20 });
    await service.validateTour(moderator, 't1', { approve: false, reason: 'photos' });
    await service.suspendTour(moderator, 't1', 'complaints');
    expect(tours.listForModeration).toHaveBeenCalledWith({ status: 'PENDING_REVIEW' }, { page: 1, limit: 20 });
    expect(tours.decideReview).toHaveBeenCalledWith(moderator, 't1', { approve: false, reason: 'photos' });
    expect(tours.suspendTour).toHaveBeenCalledWith(moderator, 't1', 'complaints');
  });

  it('reviews, accounts, reports, tickets', async () => {
    const { service, reviews, users, reports, support } = make();
    await service.moderateReview(moderator, 'r1', { hide: true, reason: 'abuse' });
    await service.banUser(moderator, 'u1', 'spam');
    await service.unbanUser(moderator, 'u1');
    await service.resolveReport(moderator, 'p1', { decision: 'RESOLVED', note: 'ok' });
    await service.replyToTicket(moderator, 'k1', { text: 'hello', resolve: true });
    await service.setTicketStatus(moderator, 'k1', 'RESOLVED');
    expect(reviews.moderate).toHaveBeenCalledWith(moderator, 'r1', { hide: true, reason: 'abuse' });
    expect(users.banUser).toHaveBeenCalledWith(moderator, 'u1', 'spam');
    expect(users.unbanUser).toHaveBeenCalledWith(moderator, 'u1');
    expect(reports.resolve).toHaveBeenCalledWith(moderator, 'p1', { decision: 'RESOLVED', note: 'ok' });
    expect(support.replyAsStaff).toHaveBeenCalledWith(moderator, 'k1', { text: 'hello', resolve: true });
    expect(support.setStatus).toHaveBeenCalledWith(moderator, 'k1', 'RESOLVED');
  });
});

describe('verifyAgency', () => {
  it('records the decision and tells the agency by app and email', async () => {
    const { service, users, notifications } = make();
    await service.verifyAgency(moderator, 'a1', { approve: true });
    expect(users.decideAgencyVerification).toHaveBeenCalledWith(moderator, 'a1', { approve: true });
    expect(notifications.notify).toHaveBeenCalledWith('a1', expect.objectContaining({ type: 'AGENCY_VERIFICATION_DECIDED', title: 'Your agency was verified' }), { email: true });
  });

  it('includes the moderator\'s note when rejecting', async () => {
    const { service, notifications } = make();
    await service.verifyAgency(moderator, 'a1', { approve: false, note: 'License unreadable' });
    expect(notifications.notify).toHaveBeenCalledWith('a1', expect.objectContaining({ body: expect.stringContaining('License unreadable') }), { email: true });
  });

  it('does not notify when the decision itself failed (e.g. invalid transition)', async () => {
    const { service, users, notifications } = make();
    users.decideAgencyVerification.mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 'INVALID_STATE_TRANSITION' }));
    await expect(service.verifyAgency(moderator, 'a1', { approve: true })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
