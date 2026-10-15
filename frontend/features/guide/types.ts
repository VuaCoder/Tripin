/** Wire shapes of `GET /guide/tours` and `POST /guide/tours/:tourId/verification` (`GuideTourDto`). */

export type GuideAssignmentStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface GuideTourAgency {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface GuideAssignedTour {
  id: string;
  title: string;
  destination: string;
  durationDays: number;
  tourStatus: string;
  agencyId: string;
  agency?: GuideTourAgency;
  assignment: {
    feePerBooking: number;
    status: GuideAssignmentStatus;
    /** Set once the guide has answered; the assignment is terminal from then on. */
    respondedAt?: string;
  };
  nextDepartureDate?: string;
}

export interface GuideTourPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GuideTourListResult {
  items: GuideAssignedTour[];
  meta: GuideTourPageMeta;
}

export interface GuideApiResponse<T> {
  success: boolean;
  data: T;
  meta?: GuideTourPageMeta;
  error?: { code: string; message: string; details?: unknown };
}

export interface AnswerAssignmentInput {
  tourId: string;
  accept: boolean;
  note?: string;
}

export interface ListAssignedToursArgs {
  page?: number;
  limit?: number;
}

/** The guide-editable half of `UpdateProfileRequest` (see `features/traveler-account/types`). */
export interface GuideProfileFields {
  bio?: string;
  languages?: string[];
  specialties?: string[];
  experienceYears?: number;
  licenseNumber?: string;
  licenseImageUrl?: string | null;
}
