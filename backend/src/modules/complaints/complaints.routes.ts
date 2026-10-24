import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission, requireAnyPermission } from '../../middlewares/authorize';
import { createRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { complaintsController } from './complaints.controller';
import {
  adjudicateComplaintTicketSchema,
  createComplaintTicketSchema,
  escalateComplaintTicketSchema,
  listComplaintsQuerySchema,
  resolveComplaintTicketSchema,
  sendComplaintMessageSchema,
  submitComplaintFeedbackSchema,
  ticketIdParams,
} from './complaints.validation';

const createLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 30 });
const messageLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: 30 });
const P = PERMISSIONS;

/** Mounted at /api/v1/complaints — Traveler tickets & shared complaint conversation endpoints. */
export const travelerComplaintsRouter = Router();
travelerComplaintsRouter.post(
  '/images/upload-signature',
  requireAnyPermission(P.REPORT_CREATE, P.COMPLAINT_RESPOND, P.DISPUTE_RESOLVE),
  complaintsController.createImageSignature,
);
travelerComplaintsRouter.post(
  '/',
  requirePermission(P.REPORT_CREATE),
  createLimiter,
  validate({ body: createComplaintTicketSchema }),
  complaintsController.createTicket,
);
travelerComplaintsRouter.get(
  '/me',
  requirePermission(P.REPORT_CREATE),
  validate({ query: listComplaintsQuerySchema }),
  complaintsController.listMyTickets,
);
travelerComplaintsRouter.get(
  '/:id',
  requireAnyPermission(P.REPORT_CREATE, P.COMPLAINT_RESPOND, P.DISPUTE_RESOLVE),
  validate({ params: ticketIdParams }),
  complaintsController.getTicketDetail,
);
travelerComplaintsRouter.post(
  '/:id/messages',
  requireAnyPermission(P.REPORT_CREATE, P.COMPLAINT_RESPOND, P.DISPUTE_RESOLVE),
  messageLimiter,
  validate({ params: ticketIdParams, body: sendComplaintMessageSchema }),
  complaintsController.sendMessage,
);
travelerComplaintsRouter.post(
  '/:id/accept-resolution',
  requirePermission(P.REPORT_CREATE),
  validate({ params: ticketIdParams }),
  complaintsController.acceptResolution,
);
travelerComplaintsRouter.post(
  '/:id/escalate',
  requireAnyPermission(P.REPORT_CREATE, P.COMPLAINT_RESPOND),
  validate({ params: ticketIdParams, body: escalateComplaintTicketSchema }),
  complaintsController.escalateTicket,
);
travelerComplaintsRouter.post(
  '/:id/feedback',
  requirePermission(P.REPORT_CREATE),
  validate({ params: ticketIdParams, body: submitComplaintFeedbackSchema }),
  complaintsController.submitFeedback,
);

/** Mounted at /api/v1/agency/complaint-tickets — Agency handling complaints. */
export const agencyComplaintTicketsRouter = Router();
agencyComplaintTicketsRouter.use(requirePermission(P.COMPLAINT_RESPOND));
agencyComplaintTicketsRouter.post('/images/upload-signature', complaintsController.createImageSignature);
agencyComplaintTicketsRouter.get('/', validate({ query: listComplaintsQuerySchema }), complaintsController.listAgencyTickets);
agencyComplaintTicketsRouter.get('/:id', validate({ params: ticketIdParams }), complaintsController.getTicketDetail);
agencyComplaintTicketsRouter.post(
  '/:id/messages',
  messageLimiter,
  validate({ params: ticketIdParams, body: sendComplaintMessageSchema }),
  complaintsController.sendMessage,
);
agencyComplaintTicketsRouter.post(
  '/:id/resolve',
  validate({ params: ticketIdParams, body: resolveComplaintTicketSchema }),
  complaintsController.resolveTicket,
);
agencyComplaintTicketsRouter.post(
  '/:id/escalate',
  validate({ params: ticketIdParams, body: escalateComplaintTicketSchema }),
  complaintsController.escalateTicket,
);

/** Mounted at /api/v1/moderation/complaint-tickets — Moderator queue & quality analytics. */
export const moderatorComplaintTicketsRouter = Router();
moderatorComplaintTicketsRouter.use(requirePermission(P.DISPUTE_RESOLVE));
moderatorComplaintTicketsRouter.post('/images/upload-signature', complaintsController.createImageSignature);
moderatorComplaintTicketsRouter.get('/', validate({ query: listComplaintsQuerySchema }), complaintsController.listModeratorTickets);
moderatorComplaintTicketsRouter.get('/dashboard/agency-quality', complaintsController.getAgencyQualityDashboard);
moderatorComplaintTicketsRouter.get('/:id', validate({ params: ticketIdParams }), complaintsController.getTicketDetail);
moderatorComplaintTicketsRouter.post(
  '/:id/messages',
  messageLimiter,
  validate({ params: ticketIdParams, body: sendComplaintMessageSchema }),
  complaintsController.sendMessage,
);
moderatorComplaintTicketsRouter.post(
  '/:id/adjudicate',
  validate({ params: ticketIdParams, body: adjudicateComplaintTicketSchema }),
  complaintsController.adjudicateTicket,
);
