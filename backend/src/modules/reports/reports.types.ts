import type { TransitionMap } from '../../utils/state-machine';

export const REPORT_TARGET = {
  TOUR: 'TOUR',
  /** An agency or a tour guide account. */
  USER: 'USER',
  REVIEW: 'REVIEW',
} as const;
export type ReportTarget = (typeof REPORT_TARGET)[keyof typeof REPORT_TARGET];

export const REPORT_CATEGORY = {
  MISLEADING_INFO: 'MISLEADING_INFO',
  SAFETY: 'SAFETY',
  SERVICE_QUALITY: 'SERVICE_QUALITY',
  PAYMENT_OR_REFUND: 'PAYMENT_OR_REFUND',
  INAPPROPRIATE_CONTENT: 'INAPPROPRIATE_CONTENT',
  OTHER: 'OTHER',
} as const;
export type ReportCategory = (typeof REPORT_CATEGORY)[keyof typeof REPORT_CATEGORY];

export const REPORT_STATUS = {
  OPEN: 'OPEN',
  AGENCY_RESPONDED: 'AGENCY_RESPONDED',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const;
export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

const S = REPORT_STATUS;
/**
 *  OPEN -> AGENCY_RESPONDED (the concerned agency answers) | RESOLVED | REJECTED (moderator decides directly)
 *  AGENCY_RESPONDED -> RESOLVED | REJECTED (moderator decides)
 */
export const REPORT_TRANSITIONS: TransitionMap<ReportStatus> = {
  [S.OPEN]: [S.AGENCY_RESPONDED, S.RESOLVED, S.REJECTED],
  [S.AGENCY_RESPONDED]: [S.RESOLVED, S.REJECTED],
};

export interface CreateReportInput {
  targetType: ReportTarget;
  targetId: string;
  category: ReportCategory;
  description: string;
  /** Optional: one of the reporter's own bookings the problem relates to (evidence for a dispute). */
  bookingId?: string;
}

export interface ListReportsQuery {
  page: number;
  limit: number;
  status?: ReportStatus;
}

/** An agency disputing a review of one of its own tours: the same pipeline, without a target the client picks. */
export interface DisputeReviewInput {
  category: ReportCategory;
  description: string;
}

export interface ListModerationReportsQuery extends ListReportsQuery {
  targetType?: ReportTarget;
  category?: ReportCategory;
}

interface ReportBaseDto {
  id: string;
  /** Lookup code (e.g. `RP-1A2B3C4D`) the reporter can quote to support. */
  code: string;
  targetType: ReportTarget;
  targetId: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  bookingId?: string;
  agencyResponse?: { text: string; respondedAt: string };
  resolution?: { decision: 'RESOLVED' | 'REJECTED'; note: string; resolvedAt: string };
  createdAt: string;
}

/** What the reporter sees. */
export type MyReportDto = ReportBaseDto;

/** What the concerned agency sees: the reporter is only identified by a masked name. */
export interface ComplaintDto extends ReportBaseDto {
  tourId?: string;
  reporterName: string;
}

/** What moderators see. The ids stay for the actions; the names are what the queue displays. */
export interface ModerationReportDto extends ReportBaseDto {
  reporterId: string;
  reporterName?: string;
  agencyId?: string;
  agencyName?: string;
  tourId?: string;
  tourTitle?: string;
  /** The reported thing itself: a tour title, an account name, or — for a review — the tour it is about. */
  targetName?: string;
  /** The booking offered as evidence, as its code (e.g. `TRP-AAAA2222`), never a uuid. */
  bookingCode?: string;
  /** Present only for a report about a review: the review itself, so the moderator need not go hunting for it. */
  review?: {
    rating: number;
    comment: string;
    status: 'VISIBLE' | 'HIDDEN';
    hiddenReason?: string;
    authorName?: string;
  };
  relatedTicket?: RelatedTicketDto;
  directChat?: DirectChatDto;
}

export interface ReportConversationMessage {
  id: string;
  senderRole: string;
  senderName?: string;
  text: string;
  attachments?: string[];
  createdAt: string;
}

export interface RelatedTicketDto {
  id: string;
  ticketCode: string;
  status: string;
  subject: string;
  messages: ReportConversationMessage[];
}

export interface DirectChatDto {
  id: string;
  messages: {
    id: string;
    senderId: string;
    senderName?: string;
    text: string;
    createdAt: string;
  }[];
}

