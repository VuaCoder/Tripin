export type ETicketStatus = 'VALID' | 'USED' | 'CANCELLED';

export interface ETicketBookingInfo {
  id: string;
  code: string;
  status?: string;
  isPaid?: boolean;
  totalAmount?: number;
  contactPhone?: string;
  endDate?: string;
}

export interface ETicketTourInfo {
  id: string;
  title: string;
  destination?: string;
  durationDays?: number;
  coverImage?: string;
}

export interface ETicketDto {
  id: string;
  /** The value encoded in the QR code */
  code: string;
  status: ETicketStatus;
  booking: ETicketBookingInfo;
  tour: ETicketTourInfo;
  departureDate: string;
  participants: number;
  holderName: string;
  issuedAt: string;
}

export interface ListETicketsQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedETickets {
  items: ETicketDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ETicketApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
