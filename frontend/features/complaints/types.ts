import type {
  ComplaintCategoryTaxonomy,
  ComplaintTaxonomyItem,
  ComplaintTicketCategory,
  ComplaintTicketPriority,
  ComplaintTicketStatus,
} from '@travel-platform/constants';

export type {
  ComplaintCategoryTaxonomy,
  ComplaintTaxonomyItem,
  ComplaintTicketCategory,
  ComplaintTicketPriority,
  ComplaintTicketStatus,
};

export interface ComplaintTicketMessage {
  id: string;
  senderId: string;
  senderRole: 'TRAVELER' | 'AGENCY' | 'MODERATOR' | 'SYSTEM';
  senderName?: string;
  text: string;
  attachments: string[];
  createdAt: string;
}

export interface ComplaintFeedback {
  id: string;
  rating: number;
  speedScore: number;
  attitudeScore: number;
  satisfactionScore: number;
  comment?: string | null;
  createdAt: string;
}

export interface ComplaintTicketSummary {
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

export interface ComplaintTicketDetail extends ComplaintTicketSummary {
  description: string;
  messages: ComplaintTicketMessage[];
  feedback?: ComplaintFeedback | null;
}

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
  ticketId: string;
  text: string;
  imagePublicIds?: string[];
}

export interface ResolveComplaintTicketInput {
  ticketId: string;
  solutionSummary: string;
}

export interface EscalateComplaintTicketInput {
  ticketId: string;
  reason: string;
}

export interface SubmitComplaintFeedbackInput {
  ticketId: string;
  rating: number;
  speedScore?: number;
  attitudeScore?: number;
  satisfactionScore?: number;
  comment?: string;
}

export interface AdjudicateComplaintTicketInput {
  ticketId: string;
  decision: string;
  note: string;
}

export interface ListComplaintsArgs {
  page?: number;
  limit?: number;
  status?: ComplaintTicketStatus;
  category?: ComplaintTicketCategory;
  search?: string;
}

export interface ComplaintPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ComplaintListResult {
  items: ComplaintTicketSummary[];
  meta: ComplaintPageMeta;
}

export interface AgencyQualityStats {
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
