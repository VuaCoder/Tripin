import type { TransitionMap } from '../../utils/state-machine';

export const TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const TICKET_CATEGORY = {
  BOOKING: 'BOOKING',
  PAYMENT: 'PAYMENT',
  ACCOUNT: 'ACCOUNT',
  TOUR: 'TOUR',
  OTHER: 'OTHER',
} as const;
export type TicketCategory = (typeof TICKET_CATEGORY)[keyof typeof TICKET_CATEGORY];

const S = TICKET_STATUS;
/**
 *  OPEN        -> IN_PROGRESS (first staff reply) | RESOLVED | CLOSED
 *  IN_PROGRESS -> RESOLVED (staff) | CLOSED (user gives up)
 *  RESOLVED    -> IN_PROGRESS (user replies again = reopened) | CLOSED (user confirms or gives up)
 *  CLOSED is final.
 */
export const TICKET_TRANSITIONS: TransitionMap<TicketStatus> = {
  [S.OPEN]: [S.IN_PROGRESS, S.RESOLVED, S.CLOSED],
  [S.IN_PROGRESS]: [S.RESOLVED, S.CLOSED],
  [S.RESOLVED]: [S.IN_PROGRESS, S.CLOSED],
};

export const SUPPORT_LIMITS = {
  MAX_MESSAGES_PER_TICKET: 200,
  MAX_TEXT_LENGTH: 4000,
} as const;

export interface CreateTicketInput {
  subject: string;
  category: TicketCategory;
  message: string;
  /** Optional: one of the user's own bookings the question is about. */
  bookingId?: string;
}

export interface ListTicketsQuery {
  page: number;
  limit: number;
  status?: TicketStatus;
}

export interface ListModerationTicketsQuery extends ListTicketsQuery {
  category?: TicketCategory;
}

export interface TicketMessageDto {
  author: 'YOU' | 'SUPPORT' | 'USER';
  text: string;
  createdAt: string;
}

export interface TicketSummaryDto {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  bookingId?: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface TicketDto extends TicketSummaryDto {
  messages: TicketMessageDto[];
}

/** Moderator view: knows who opened it and who handles it. */
export interface ModerationTicketDto extends TicketDto {
  userId: string;
  assignedTo?: string;
}
