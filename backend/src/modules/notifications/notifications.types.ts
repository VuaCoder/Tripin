/** Every kind of in-app notification. Add new kinds here, never inline strings in other modules. */
export const NOTIFICATION_TYPE = {
  TOUR_APPROVED: 'TOUR_APPROVED',
  TOUR_REJECTED: 'TOUR_REJECTED',
  TOUR_SUSPENDED: 'TOUR_SUSPENDED',
  GUIDE_ASSIGNED: 'GUIDE_ASSIGNED',
  GUIDE_ASSIGNMENT_ANSWERED: 'GUIDE_ASSIGNMENT_ANSWERED',
  AGENCY_VERIFICATION_DECIDED: 'AGENCY_VERIFICATION_DECIDED',
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_COMPLETED: 'BOOKING_COMPLETED',
  PAYMENT_SUCCEEDED: 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  ETICKET_ISSUED: 'ETICKET_ISSUED',
  REVIEW_RECEIVED: 'REVIEW_RECEIVED',
  REVIEW_MODERATED: 'REVIEW_MODERATED',
  REPORT_UPDATED: 'REPORT_UPDATED',
  REPORT_RESOLVED: 'REPORT_RESOLVED',
  COMPLAINT_RECEIVED: 'COMPLAINT_RECEIVED',
  SUPPORT_REPLIED: 'SUPPORT_REPLIED',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  SUBSCRIPTION_ACTIVATED: 'SUBSCRIPTION_ACTIVATED',
  EARNING_RECORDED: 'EARNING_RECORDED',
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  /** Small, non-sensitive references for deep links, e.g. `{ tourId }`, `{ bookingId }`. */
  data?: Record<string, string>;
}

export interface NotifyOptions {
  /** Also send the notification by email (to the user's registered address). Default false. */
  email?: boolean;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface ListNotificationsQuery {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

/** Set by the realtime layer (chat/socket module) to push new notifications to connected clients. */
export type NotificationPublisher = (userId: string, notification: NotificationDto) => void;
