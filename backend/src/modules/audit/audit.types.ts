import type { PersistedRole } from '@travel-platform/constants';

/** Every sensitive action that must leave a trace. Add new actions here, never inline strings in services. */
export const AUDIT_ACTIONS = {
  USER_ACCESS_ASSIGNED: 'user.access_assigned',
  USER_BANNED: 'user.banned',
  USER_UNBANNED: 'user.unbanned',
  AGENCY_VERIFICATION_DECIDED: 'agency.verification_decided',
  COMMISSION_UPDATED: 'settings.commission_updated',
  POLICY_UPDATED: 'settings.policy_updated',
  CATEGORY_CREATED: 'category.created',
  CATEGORY_UPDATED: 'category.updated',
  CATEGORY_DELETED: 'category.deleted',
  TOUR_VALIDATED: 'tour.validated',
  TOUR_SUSPENDED: 'tour.suspended',
  REVIEW_MODERATED: 'review.moderated',
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
}
