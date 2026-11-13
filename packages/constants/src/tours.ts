export const TOUR_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type TourStatus = (typeof TOUR_STATUS)[keyof typeof TOUR_STATUS];

/** PRIVATE tours belong to one group-booking request and never appear in public discovery. */
export const TOUR_VISIBILITY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;
export type TourVisibility = (typeof TOUR_VISIBILITY)[keyof typeof TOUR_VISIBILITY];

/** Answer of a tour guide to "you were assigned to this tour". */
export const GUIDE_ASSIGNMENT_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
} as const;
export type GuideAssignmentStatus = (typeof GUIDE_ASSIGNMENT_STATUS)[keyof typeof GUIDE_ASSIGNMENT_STATUS];
