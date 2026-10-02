import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { moderationController as c } from './moderation.controller';
import {
  banBody,
  idParams,
  listAgenciesQuery,
  listReportsQuery,
  listReviewsQuery,
  listTicketsQuery,
  listToursQuery,
  moderateReviewBody,
  resolveReportBody,
  suspendTourBody,
  ticketReplyBody,
  ticketStatusBody,
  validateTourBody,
  verifyAgencyBody,
} from './moderation.validation';

const P = PERMISSIONS;

/**
 * Mounted at /api/v1/moderation. Every route names the exact permission of its use case (MODERATOR has them all by
 * default; SUPER_ADMIN has everything). Nothing here contains logic: see ModerationService and the owning modules.
 */
export const moderationRouter = Router();

// Tour lists, validation, suspension
moderationRouter.get('/tours', requirePermission(P.TOUR_LIST_ALL), validate({ query: listToursQuery }), c.listTours);
moderationRouter.get('/tours/:id', requirePermission(P.TOUR_LIST_ALL), validate({ params: idParams }), c.getTour);
moderationRouter.post('/tours/:id/validate', requirePermission(P.TOUR_VALIDATE), validate({ params: idParams, body: validateTourBody }), c.validateTour);
moderationRouter.post('/tours/:id/suspend', requirePermission(P.TOUR_SUSPEND), validate({ params: idParams, body: suspendTourBody }), c.suspendTour);

// Agency profile verification
moderationRouter.get('/agencies', requirePermission(P.AGENCY_VERIFY), validate({ query: listAgenciesQuery }), c.listAgencies);
moderationRouter.post('/agencies/:id/verify', requirePermission(P.AGENCY_VERIFY), validate({ params: idParams, body: verifyAgencyBody }), c.verifyAgency);

// Reviews
moderationRouter.get('/reviews', requirePermission(P.REVIEW_MODERATE), validate({ query: listReviewsQuery }), c.listReviews);
moderationRouter.post('/reviews/:id/moderate', requirePermission(P.REVIEW_MODERATE), validate({ params: idParams, body: moderateReviewBody }), c.moderateReview);

// Accounts
moderationRouter.post('/users/:id/ban', requirePermission(P.ACCOUNT_BAN), validate({ params: idParams, body: banBody }), c.ban);
moderationRouter.post('/users/:id/unban', requirePermission(P.ACCOUNT_BAN), validate({ params: idParams }), c.unban);

// Disputes (reports)
moderationRouter.get('/reports', requirePermission(P.DISPUTE_RESOLVE), validate({ query: listReportsQuery }), c.listReports);
moderationRouter.get('/reports/:id', requirePermission(P.DISPUTE_RESOLVE), validate({ params: idParams }), c.getReport);
moderationRouter.post('/reports/:id/resolve', requirePermission(P.DISPUTE_RESOLVE), validate({ params: idParams, body: resolveReportBody }), c.resolveReport);

// Complaints (support tickets)
moderationRouter.get('/support-tickets', requirePermission(P.COMPLAINT_HANDLE), validate({ query: listTicketsQuery }), c.listTickets);
moderationRouter.get('/support-tickets/:id', requirePermission(P.COMPLAINT_HANDLE), validate({ params: idParams }), c.getTicket);
moderationRouter.post('/support-tickets/:id/reply', requirePermission(P.COMPLAINT_HANDLE), validate({ params: idParams, body: ticketReplyBody }), c.replyToTicket);
moderationRouter.patch('/support-tickets/:id/status', requirePermission(P.COMPLAINT_HANDLE), validate({ params: idParams, body: ticketStatusBody }), c.setTicketStatus);
