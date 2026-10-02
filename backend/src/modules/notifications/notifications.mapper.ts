import type { NotificationDocument } from './notifications.model';
import type { NotificationDto, NotificationType } from './notifications.types';

export function toNotificationDto(notification: NotificationDocument): NotificationDto {
  const data = notification.data ? Object.fromEntries(notification.data as unknown as Map<string, string>) : undefined;
  return {
    id: notification.id,
    type: notification.type as NotificationType,
    title: notification.title,
    body: notification.body,
    data: data && Object.keys(data).length > 0 ? data : undefined,
    isRead: Boolean(notification.readAt),
    readAt: notification.readAt?.toISOString(),
    createdAt: (notification as unknown as { createdAt: Date }).createdAt.toISOString(),
  };
}
