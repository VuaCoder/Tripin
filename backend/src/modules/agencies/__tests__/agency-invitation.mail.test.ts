import { describe, expect, it } from 'vitest';
import { buildAgencyInvitationMail } from '../agency-invitation.mail';

describe('agency invitation notification', () => {
  it('uses real company, role and expiry, without a website link or token', () => {
    const mail = buildAgencyInvitationMail('Heritage Routes', 'Điều hành', new Date('2026-11-13T10:00:00Z'));
    expect(mail.subject).toBe('[Tripri Partner] Lời mời tham gia Heritage Routes');
    expect(mail.text).toContain('Điều hành');
    expect(mail.text).toContain('Lời mời của tôi');
    expect(mail.text).toContain('17:00');
    expect(mail.text).toContain('UTC+7');
    expect(mail.text).toContain('xác minh email');
    expect(mail.text).not.toMatch(/https?:|localhost|token=|href=/i);
  });
});
