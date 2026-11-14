import type { PersistedRole } from '@travel-platform/constants';

/** Every sensitive action that must leave a trace. Add new actions here, never inline strings in services. */
export const AUDIT_ACTIONS = {
  AGENCY_CREATED: 'agency.created',
  AGENCY_APPLICATION_SAVED: 'agency.application_saved',
  AGENCY_JOIN_CODE_CHANGED: 'agency.join_code_changed',
  AGENCY_JOIN_REQUEST_CHANGED: 'agency.join_request_changed',
  AGENCY_ROLE_SAVED: 'agency.role_saved',
  AGENCY_TOUR_SCOPE_CHANGED: 'agency.tour_scope_changed',
  AGENCY_TOUR_CONTENT_CHANGED: 'agency.tour_content_changed',
  AGENCY_MEMBER_ACCESS_CHANGED: 'agency.member_access_changed',
  AGENCY_INVITATION_REVOKED: 'agency.invitation_revoked',
  AGENCY_MEMBER_CHANGED: 'agency.member_changed',
  AGENCY_INVITATION_CREATED: 'agency.invitation_created',
  AGENCY_INVITATION_ACCEPTED: 'agency.invitation_accepted',
  AUDIT_EXPORTED: 'audit.exported',
  PREMIUM_CHANGED: 'premium.changed',
  USER_ACCESS_ASSIGNED: 'user.access_assigned',
  USER_BANNED: 'user.banned',
  USER_UNBANNED: 'user.unbanned',
  USER_DELETED: 'user.deleted',
  AGENCY_VERIFICATION_DECIDED: 'agency.verification_decided',
  COMMISSION_UPDATED: 'settings.commission_updated',
  AGENCY_COMMISSION_UPDATED: 'settings.agency_commission_updated',
  POLICY_UPDATED: 'settings.policy_updated',
  CATEGORY_CREATED: 'category.created',
  CATEGORY_UPDATED: 'category.updated',
  CATEGORY_DELETED: 'category.deleted',
  TOUR_VALIDATED: 'tour.validated',
  TOUR_SUSPENDED: 'tour.suspended',
  REVIEW_MODERATED: 'review.moderated',
  GUIDE_PAYOUT_TRANSFERRED: 'guide_payout.transferred',
  REPORT_RESOLVED: 'report.resolved',
  PROMOTION_PLATFORM_CHANGED: 'promotion.platform_changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntry {
  actorId: string;
  actorRole: PersistedRole;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  /** Small, non-sensitive context (before/after values, reason). Never put secrets, tokens or personal documents here. */
  metadata?: Record<string, unknown>;
}

export interface AuditLogDto {
  id: string;
  actorId: string;
  actorName?: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ListAuditQuery {
  page: number;
  limit: number;
  actorId?: string;
  action?: AuditAction;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  order?: 'asc' | 'desc';
}
