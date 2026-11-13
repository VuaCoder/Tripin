import { describe, expect, it } from 'vitest';
import { canReceiveAgencyNotification as allows } from '../notifications.policy';

describe('agency notification recipient policy', () => {
  it('does not send financial or personal notifications to tour-only members', () => {
    expect(allows('STAFF', 'PAYMENT_SUCCEEDED')).toBe(false);
    expect(allows('STAFF', 'EARNING_RECORDED')).toBe(false);
    expect(allows('ACCOUNTANT', 'PAYMENT_SUCCEEDED')).toBe(true);
    expect(allows('OWNER', 'CHAT_MESSAGE')).toBe(false);
  });
  it('allows booking notifications for all booking-view roles', () => {
    for (const role of ['OWNER','MANAGER','ACCOUNTANT'] as const) expect(allows(role,'BOOKING_CONFIRMED')).toBe(true);
    expect(allows('STAFF','BOOKING_CONFIRMED')).toBe(false);
  });
  it('does not send complaint content to ACCOUNTANT', () => {
    expect(allows('ACCOUNTANT','COMPLAINT_MESSAGE')).toBe(false);
    expect(allows('STAFF','COMPLAINT_MESSAGE')).toBe(false);
  });
  it('does not send review/report moderation content to ACCOUNTANT', () => {
    expect(allows('ACCOUNTANT','REVIEW_MODERATED')).toBe(false);
    expect(allows('ACCOUNTANT','REPORT_UPDATED')).toBe(false);
    expect(allows('MANAGER','REVIEW_MODERATED')).toBe(true);
  });
  it('sends agency verification decisions only to team managers', () => {
    expect(allows('OWNER','AGENCY_VERIFICATION_DECIDED')).toBe(true);
    for (const role of ['MANAGER','STAFF','ACCOUNTANT'] as const) expect(allows(role,'AGENCY_VERIFICATION_DECIDED')).toBe(false);
  });
  it('sends tour decisions only to tour-managing roles', () => {
    expect(allows('STAFF','TOUR_APPROVED')).toBe(true);
    expect(allows('OWNER','TOUR_SUSPENDED')).toBe(true);
    expect(allows('ACCOUNTANT','TOUR_APPROVED')).toBe(false);
  });
});
