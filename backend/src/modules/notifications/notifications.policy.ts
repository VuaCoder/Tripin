import { PERMISSIONS } from '@travel-platform/constants';
import { AGENCY_ROLE_PERMISSIONS, type AgencyPermission } from '../agencies/agency.policy';
import type { AgencyMemberRole } from '../../generated/prisma/client';
import type { NotificationType } from './notifications.types';

export function agencyNotificationPermission(type: NotificationType): AgencyPermission | null {
  if (type === 'AGENCY_JOIN_REQUESTED') return 'agency:team-view';
  return type.startsWith('COMPLAINT_') ? PERMISSIONS.COMPLAINT_RESPOND
    : type.startsWith('BOOKING_') ? PERMISSIONS.AGENCY_BOOKINGS_VIEW
    : type.startsWith('REVIEW_') || type.startsWith('REPORT_') ? PERMISSIONS.REVIEW_DISPUTE
    : type.startsWith('PAYMENT_') || type.startsWith('EARNING_') ? 'agency:finance-view'
    : type.startsWith('ETICKET_') ? PERMISSIONS.AGENCY_BOOKINGS_VIEW
    : type.startsWith('GUIDE_') ? PERMISSIONS.TOUR_ASSIGN_GUIDE
    : type === 'AGENCY_VERIFICATION_DECIDED' ? 'agency:team-manage'
    : type.startsWith('CUSTOM_TOUR_') ? PERMISSIONS.CUSTOM_TOUR_VIEW
    : type.startsWith('TOUR_') ? 'agency:tour-view' : null;
}

export function canReceiveAgencyNotification(source: AgencyMemberRole | readonly AgencyPermission[], type: NotificationType): boolean {
  const permissions = typeof source === 'string' ? AGENCY_ROLE_PERMISSIONS[source] : source;
  const required = agencyNotificationPermission(type);
  return required !== null && permissions.includes(required);
}
