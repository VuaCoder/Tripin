import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as constants from '@travel-platform/constants';
import { describe, expect, it } from 'vitest';
import { ETICKET_STATUS } from '../../modules/e-tickets/e-tickets.types';
import { NOTIFICATION_TYPE } from '../../modules/notifications/notifications.types';
import { REPORT_CATEGORY, REPORT_STATUS, REPORT_TARGET } from '../../modules/reports/reports.types';
import { REVIEW_STATUS } from '../../modules/reviews/reviews.types';
import { SUBSCRIPTION_STATUS } from '../../modules/subscriptions/subscriptions.types';
import { TICKET_CATEGORY, TICKET_STATUS } from '../../modules/support/support.types';

// prisma/schema.prisma declares the enums by hand (Prisma cannot import TypeScript). This keeps them identical to the
// constants the services use, so a value added on one side cannot silently fail at the database on the other.
const schema = readFileSync(path.resolve(process.cwd(), '../prisma/schema.prisma'), 'utf-8');

const prismaEnums = new Map<string, string[]>();
for (const match of schema.matchAll(/^enum (\w+) \{([^}]*)\}/gm)) {
  prismaEnums.set(match[1]!, match[2]!.split('\n').map((line) => line.trim()).filter(Boolean));
}

const code: Record<string, readonly string[]> = {
  Role: constants.PERSISTED_ROLES,
  UserStatus: Object.values(constants.USER_STATUS),
  OtpPurpose: Object.values(constants.OTP_PURPOSE),
  AgencyVerificationStatus: Object.values(constants.AGENCY_VERIFICATION_STATUS),
  TourStatus: Object.values(constants.TOUR_STATUS),
  GuideAssignmentStatus: Object.values(constants.GUIDE_ASSIGNMENT_STATUS),
  BookingStatus: Object.values(constants.BOOKING_STATUS),
  BookingCancelReason: Object.values(constants.BOOKING_CANCEL_REASON),
  PaymentPurpose: Object.values(constants.PAYMENT_PURPOSE),
  PaymentStatus: Object.values(constants.PAYMENT_STATUS),
  PromotionScope: Object.values(constants.PROMOTION_SCOPE),
  DiscountType: Object.values(constants.DISCOUNT_TYPE),
  ETicketStatus: Object.values(ETICKET_STATUS),
  NotificationType: Object.values(NOTIFICATION_TYPE),
  ReportTarget: Object.values(REPORT_TARGET),
  ReportCategory: Object.values(REPORT_CATEGORY),
  ReportStatus: Object.values(REPORT_STATUS),
  ReviewStatus: Object.values(REVIEW_STATUS),
  SubscriptionStatus: Object.values(SUBSCRIPTION_STATUS),
  TicketStatus: Object.values(TICKET_STATUS),
  TicketCategory: Object.values(TICKET_CATEGORY),
};

describe('prisma/schema.prisma enums match the code', () => {
  it('declares exactly the enums the code maps', () => {
    expect([...prismaEnums.keys()].sort()).toEqual(Object.keys(code).sort());
  });

  it.each(Object.keys(code))('%s has the same values', (name) => {
    expect(prismaEnums.get(name)).toEqual([...code[name]!]);
  });
});
