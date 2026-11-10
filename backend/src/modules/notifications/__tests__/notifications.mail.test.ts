import { describe, expect, it } from 'vitest';
import { buildNotificationMail } from '../notifications.mail';
import { NOTIFICATION_TYPE } from '../notifications.types';

describe('buildSubscriptionExpiringMail', () => {
  it('builds an attractive branded HTML email when subscription is expiring soon', () => {
    const contact = { email: 'traveler@example.com', fullName: 'Trần Văn Du Khách' };
    const mail = buildNotificationMail(contact, {
      type: NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRING_SOON,
      title: 'Gói Premium sắp hết hạn',
      body: 'Gói của bạn sắp hết hạn',
      data: {
        subscriptionId: 'sub-123',
        planName: 'Hội Viên Du Khách 90 Ngày',
        endsAt: '2026-11-20T12:00:00.000Z',
      },
    });

    expect(mail.to).toBe('traveler@example.com');
    expect(mail.subject).toContain('[Tripri Premium] Gói hội viên của bạn sắp hết hạn sau 3 ngày');
    expect(mail.text).toContain('Hội Viên Du Khách 90 Ngày');
    expect(mail.text).toContain('/premium');
    expect(mail.html).toContain('👑 TRIPRI PREMIUM');
    expect(mail.html).toContain('Còn 3 ngày trải nghiệm Premium');
    expect(mail.html).toContain('Gia hạn gói Premium ngay');
    expect(mail.html).toContain('Viền vương miện hoàng gia');
  });
});

