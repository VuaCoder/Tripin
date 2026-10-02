// Public surface of notifications. Other modules call `notificationsService.notify(userId, {...}, { email? })`.
export { notificationsRouter } from './notifications.routes';
export { notificationsService, NotificationsService } from './notifications.service';
export { NOTIFICATION_TYPE, type NotificationDto, type NotificationType, type NotifyInput } from './notifications.types';
