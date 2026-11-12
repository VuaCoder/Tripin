'use client';

import type { AgencyInvitationRole } from './api/agencyInvitationApi';

/** Vietnamese display names for the planned agency member roles (invitation). */
export const roleLabels: Record<AgencyInvitationRole, string> = {
  OWNER: 'Chủ doanh nghiệp',
  MANAGER: 'Quản lý',
  STAFF: 'Nhân viên',
  ACCOUNTANT: 'Kế toán',
};

export const roleLabel = (role?: AgencyInvitationRole): string =>
  role ? (roleLabels[role] ?? role) : '';
