/** Group-booking request lifecycle. Key order matches the Prisma enum (checked by the enum-sync test). */
export const CUSTOM_TOUR_STATUS = {
  SUBMITTED: 'SUBMITTED',
  NEGOTIATING: 'NEGOTIATING',
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
} as const;
export type CustomTourStatus = (typeof CUSTOM_TOUR_STATUS)[keyof typeof CUSTOM_TOUR_STATUS];

export const PASSENGER_TYPE = {
  ADULT: 'ADULT',
  CHILD: 'CHILD',
  INFANT: 'INFANT',
} as const;
export type PassengerType = (typeof PASSENGER_TYPE)[keyof typeof PASSENGER_TYPE];

export const CUSTOM_TOUR_POLICY = {
  MIN_PARTICIPANTS: 2,
  MAX_PARTICIPANTS: 50,
  MAX_NOTES: 500,
} as const;
