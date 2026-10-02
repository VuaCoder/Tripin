import { Router } from 'express';
import { requireAuth } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { notificationsController } from './notifications.controller';
import { listNotificationsQuery, notificationIdParams } from './notifications.validation';

/** Mounted at /api/v1/notifications — any logged-in user's own inbox. */
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get('/', validate({ query: listNotificationsQuery }), notificationsController.list);
notificationsRouter.get('/unread-count', notificationsController.unreadCount);
notificationsRouter.post('/read-all', notificationsController.markAllRead);
notificationsRouter.patch('/:id/read', validate({ params: notificationIdParams }), notificationsController.markRead);
