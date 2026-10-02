import type { NotificationRecord } from './notifications.repository';
import type { NotificationDto, NotificationType } from './notifications.types';

export function toNotificationDto(notification: NotificationRecord): NotificationDto {
  const data = notification.data ?? undefined;
  return {
    id: notification.id,
    type: notification.type as NotificationType,
    title: notification.title,
    body: notification.body,
    data: data && Object.keys(data).length > 0 ? data : undefined,
    isRead: Boolean(notification.readAt),
    readAt: notification.readAt?.toISOString(),
    createdAt: notification.createdAt.toISOString(),
  };
}
