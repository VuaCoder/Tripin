import type { BookingStatus } from '@/features/booking/types';

export interface AgencyDashboard {
  customers?: number;
  generatedAt: string;
  tours: { total: number; byStatus: Record<string, number> };
  bookings: Record<string, number>;
  revenue: { bookings: number; gross: number; commission: number; net: number };
  last30Days: { date: string; bookings: number; net: number }[];
  last6Months?: { month: string; bookings: number; net: number }[];
  topTours: { tourId: string; title: string; coverImage?: string | null; bookings: number; net: number }[];
  openComplaints: number;
}

export interface AgencyBooking {
  id: string;
  bookingCode: string;
  status: BookingStatus;
  tour: { id: string; title: string };
  departureId: string;
  departureDate: string;
  participants: number;
  totalAmount: number;
  commissionAmount: number;
  agencyAmount: number;
  isPaid: boolean;
  traveler?: { fullName: string; phone: string };
  notes?: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
}

export interface AgencyBookingFilters {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  tourId?: string;
  departureFrom?: string;
  departureTo?: string;
}

export interface AgencyGuide {
  premiumActive?: boolean;
  id: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  languages: string[];
  specialties: string[];
  experienceYears?: number;
}
