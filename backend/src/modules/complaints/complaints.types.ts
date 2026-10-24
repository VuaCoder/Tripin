import {
  COMPLAINT_TAXONOMY,
  COMPLAINT_TICKET_CATEGORY,
  COMPLAINT_TICKET_PRIORITY,
  COMPLAINT_TICKET_STATUS,
  type ComplaintCategoryTaxonomy,
  type ComplaintTaxonomyItem,
  type ComplaintTicketCategory,
  type ComplaintTicketPriority,
  type ComplaintTicketStatus,
} from '@travel-platform/constants';
import type { TransitionMap } from '../../utils/state-machine';

export {
  COMPLAINT_TAXONOMY,
  COMPLAINT_TICKET_CATEGORY,
  COMPLAINT_TICKET_PRIORITY,
  COMPLAINT_TICKET_STATUS,
  type ComplaintCategoryTaxonomy,
  type ComplaintTaxonomyItem,
  type ComplaintTicketCategory,
  type ComplaintTicketPriority,
  type ComplaintTicketStatus,
};

const S = COMPLAINT_TICKET_STATUS;

/**
 * State machine:
 * OPEN        -> IN_PROGRESS | RESOLVED | CLOSED | ESCALATED
 * IN_PROGRESS -> RESOLVED | CLOSED | ESCALATED
 * RESOLVED    -> IN_PROGRESS (traveler rejects / replies) | CLOSED (traveler accepts / auto-close) | ESCALATED
 * ESCALATED   -> CLOSED (moderator decision)
 * CLOSED is final.
 */
export const COMPLAINT_TRANSITIONS: TransitionMap<ComplaintTicketStatus> = {
  [S.OPEN]: [S.IN_PROGRESS, S.RESOLVED, S.CLOSED, S.ESCALATED],
  [S.IN_PROGRESS]: [S.RESOLVED, S.CLOSED, S.ESCALATED],
  [S.RESOLVED]: [S.IN_PROGRESS, S.CLOSED, S.ESCALATED],
  [S.ESCALATED]: [S.CLOSED],
};

export const COMPLAINT_LIMITS = {
  MAX_MESSAGES_PER_TICKET: 200,
  MAX_TEXT_LENGTH: 4000,
  AUTO_CLOSE_HOURS: 72,
} as const;

export interface CreateComplaintTicketInput {
  tourId: string;
  bookingId?: string;
  category: ComplaintTicketCategory;
  subCategory: string;
  subject: string;
  description: string;
  imagePublicIds?: string[];
}

export interface SendComplaintMessageInput {
  text: string;
  imagePublicIds?: string[];
}

export interface ResolveComplaintTicketInput {
  solutionSummary: string;
}

export interface EscalateComplaintTicketInput {
  reason: string;
}

export interface SubmitComplaintFeedbackInput {
  rating: number; // 1-5
  speedScore?: number; // 1-5
  attitudeScore?: number; // 1-5
  satisfactionScore?: number; // 1-5
  comment?: string;
}

export interface AdjudicateComplaintTicketInput {
  decision: string;
  note: string;
}

export interface ListComplaintsQuery {
  page: number;
  limit: number;
  status?: ComplaintTicketStatus;
  category?: ComplaintTicketCategory;
  search?: string;
}

export interface ComplaintTicketMessageDto {
  id: string;
  senderId: string;
  senderRole: 'TRAVELER' | 'AGENCY' | 'MODERATOR' | 'SYSTEM';
  senderName?: string;
  text: string;
  attachments: string[];
  createdAt: string;
}

export interface ComplaintFeedbackDto {
  id: string;
  rating: number;
  speedScore: number;
  attitudeScore: number;
  satisfactionScore: number;
  comment?: string | null;
  createdAt: string;
}

export interface ComplaintTicketSummaryDto {
  id: string;
  ticketCode: string;
  tourId: string;
  tourTitle?: string;
  bookingId?: string | null;
  bookingCode?: string | null;
  travelerId: string;
  travelerName?: string;
  agencyId: string;
  agencyName?: string;
  category: ComplaintTicketCategory;
  subCategory: string;
  subject: string;
  status: ComplaintTicketStatus;
  priority: ComplaintTicketPriority;
  solutionSummary?: string | null;
  moderatorDecision?: string | null;
  messageCount: number;
  lastMessageAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  escalatedAt?: string | null;
  hasFeedback: boolean;
  rating?: number | null;
  createdAt: string;
}

export interface ComplaintTicketDetailDto extends ComplaintTicketSummaryDto {
  description: string;
  messages: ComplaintTicketMessageDto[];
  feedback?: ComplaintFeedbackDto | null;
}

export interface AgencyQualityStatsDto {
  agencyId: string;
  agencyName: string;
  totalComplaints: number;
  resolvedCount: number;
  closedCount: number;
  escalatedCount: number;
  avgRating: number;
  avgSpeedScore: number;
  avgAttitudeScore: number;
  avgSatisfactionScore: number;
  totalFeedbacks: number;
  resolutionRatePercent: number;
}
