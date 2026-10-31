import type { GuestCounts } from '@travel-platform/constants';

export const ETICKET_STATUS = {
  /** Issued and usable for the trip. */
  VALID: 'VALID',
  /** The trip took place (booking COMPLETED). */
  USED: 'USED',
  /** The booking was cancelled; the ticket must not be honoured. */
  CANCELLED: 'CANCELLED',
} as const;
export type ETicketStatus = (typeof ETICKET_STATUS)[keyof typeof ETICKET_STATUS];

export const ETICKET_POLICY = {
  CODE_PREFIX: 'ETK',
  CODE_LENGTH: 16,
  CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  CODE_MAX_ATTEMPTS: 5,
} as const;

export interface ETicketDto {
  id: string;
  /** The value to encode in the QR code; unguessable. */
  code: string;
  status: ETicketStatus;
  booking: {
    id: string;
    code: string;
    status?: string;
    isPaid?: boolean;
    totalAmount?: number;
    contactPhone?: string;
    endDate?: string;
  };
  tour: {
    id: string;
    title: string;
    destination?: string;
    meetingPoint?: string;
    durationDays?: number;
    coverImage?: string;
  };
  departureDate: string;
  participants: number;
  holderName: string;
  issuedAt: string;
}

export interface ListETicketsQuery {
  page: number;
  limit: number;
}

/** One booking group in a guide's tour roster. The ticket code is deliberately not exposed here. */
export interface GuideRosterItemDto {
  ticketId: string;
  bookingCode: string;
  holderName: string;
  participants: number;
  contactPhone?: string;
  guests: GuestCounts;
  notes?: string;
  departureDate: string;
  checkedIn: boolean;
  checkedInAt?: string;
}

export interface GuideRosterDto {
  tourId: string;
  tourTitle: string;
  total: number;
  checkedIn: number;
  items: GuideRosterItemDto[];
}

export interface GuideCheckInDto {
  ticketId: string;
  holderName: string;
  participants: number;
  tourTitle: string;
  checkedInAt: string;
}

