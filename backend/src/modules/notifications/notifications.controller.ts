import type { RequestHandler } from 'express';
import { userActor } from '../../middlewares/authorize';
import { validated } from '../../middlewares/validate';
import { sendOk, sendPaginated } from '../../utils/api-response';
import type { IdParams } from '../../utils/id';
import { notificationsService, type NotificationsService } from './notifications.service';
import type { ListNotificationsQueryInput } from './notifications.validation';

/** HTTP only. Every handler works on the logged-in user's own inbox. */
export class NotificationsController {
  constructor(private readonly service: NotificationsService = notificationsService) {}

  list: RequestHandler = async (req, res) => {
    const { query } = validated<unknown, ListNotificationsQueryInput>(req);
    const page = await this.service.list(userActor(req).userId, query);
    sendPaginated(res, page.items, page.meta);
  };

  unreadCount: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.unreadCount(userActor(req).userId));
  };

  markRead: RequestHandler = async (req, res) => {
    const { params } = validated<unknown, unknown, IdParams>(req);
    sendOk(res, await this.service.markRead(userActor(req).userId, params.id));
  };

  markAllRead: RequestHandler = async (req, res) => {
    sendOk(res, await this.service.markAllRead(userActor(req).userId));
  };
}

export const notificationsController = new NotificationsController();
