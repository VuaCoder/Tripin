export interface EarningDto {
  id: string;
  bookingId: string;
  bookingCode: string;
  tour: { id: string; title: string };
  /** Integer VND the agency owes the guide for this booking (the fee set when the guide was assigned). */
  amount: number;
  earnedAt: string;
}

export interface EarningsSummaryDto {
  totalAmount: number;
  count: number;
  byMonth: { month: string; totalAmount: number; count: number }[];
}

export interface ListEarningsQuery {
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
}

export interface EarningsRange {
  from?: Date;
  to?: Date;
}
