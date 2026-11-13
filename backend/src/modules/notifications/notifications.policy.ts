import { PERMISSIONS } from '@travel-platform/constants';
import { AGENCY_ROLE_PERMISSIONS, type AgencyPermission } from '../agencies/agency.policy';
import type { AgencyMemberRole } from '../../generated/prisma/client';
import type { NotificationType } from './notifications.types';

export function canReceiveAgencyNotification(role: AgencyMemberRole, type: NotificationType): boolean {
  const permission: AgencyPermission = type.startsWith('COMPLAINT_') ? PERMISSIONS.COMPLAINT_RESPOND
    : type.startsWith('BOOKING_') ? PERMISSIONS.AGENCY_BOOKINGS_VIEW
    : type.startsWith('REVIEW_') || type.startsWith('REPORT_') ? PERMISSIONS.REVIEW_DISPUTE
    : type.startsWith('CUSTOM_TOUR_') ? PERMISSIONS.CUSTOM_TOUR_VIEW
    : type === 'AGENCY_VERIFICATION_DECIDED' ? 'agency:team-manage' : PERMISSIONS.TOUR_UPDATE_OWN;
  return AGENCY_ROLE_PERMISSIONS[role].includes(permission);
}
