export const TOUR_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type TourStatus = (typeof TOUR_STATUS)[keyof typeof TOUR_STATUS];

/** Answer of a tour guide to "you were assigned to this tour". */
export const GUIDE_ASSIGNMENT_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
} as const;
export type GuideAssignmentStatus = (typeof GUIDE_ASSIGNMENT_STATUS)[keyof typeof GUIDE_ASSIGNMENT_STATUS];
