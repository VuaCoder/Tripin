import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { createRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { supportController } from './support.controller';
import { createTicketBody, listTicketsQuery, replyBody, ticketIdParams } from './support.validation';

const createLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 10 });
const replyLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: 30 });

/** Mounted at /api/v1/support/tickets — the logged-in traveler's help requests ("Send ticket"). */
export const supportRouter = Router();
supportRouter.use(requirePermission(PERMISSIONS.SUPPORT_TICKET_CREATE));
supportRouter.post('/', createLimiter, validate({ body: createTicketBody }), supportController.create);
// '/me' is declared before '/:id'.
supportRouter.get('/me', validate({ query: listTicketsQuery }), supportController.listMine);
supportRouter.get('/:id', validate({ params: ticketIdParams }), supportController.getMine);
supportRouter.post('/:id/messages', replyLimiter, validate({ params: ticketIdParams, body: replyBody }), supportController.reply);
supportRouter.post('/:id/close', validate({ params: ticketIdParams }), supportController.close);
