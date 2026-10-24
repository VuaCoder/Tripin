import type { Request, Response } from 'express';
import { userActor } from '../../middlewares/authorize';
import { complaintsService, type ComplaintsService } from './complaints.service';
import {
  adjudicateComplaintTicketSchema,
  createComplaintTicketSchema,
  escalateComplaintTicketSchema,
  listComplaintsQuerySchema,
  resolveComplaintTicketSchema,
  sendComplaintMessageSchema,
  submitComplaintFeedbackSchema,
} from './complaints.validation';

export class ComplaintsController {
  constructor(private readonly service: ComplaintsService = complaintsService) {}

  createImageSignature = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const signature = this.service.createImageSignature(actor.userId);
    res.status(201).json({ success: true, data: signature });
  };

  // ================================================================ Traveler
  createTicket = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const input = createComplaintTicketSchema.parse(req.body);
    const result = await this.service.createTicket(actor.userId, input as any);
    res.status(201).json({ success: true, data: result });
  };

  listMyTickets = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const query = listComplaintsQuerySchema.parse(req.query);
    const result = await this.service.listTravelerTickets(actor.userId, query as any);
    res.json({ success: true, ...result });
  };

  acceptResolution = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const ticketId = String(req.params.id);
    const result = await this.service.acceptResolution(ticketId, actor.userId);
    res.json({ success: true, data: result });
  };

  submitFeedback = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const ticketId = String(req.params.id);
    const input = submitComplaintFeedbackSchema.parse(req.body);
    const result = await this.service.submitFeedback(ticketId, actor.userId, input);
    res.status(201).json({ success: true, data: result });
  };

  // ================================================================== Agency
  listAgencyTickets = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const query = listComplaintsQuerySchema.parse(req.query);
    const result = await this.service.listAgencyTickets(actor.userId, query as any);
    res.json({ success: true, ...result });
  };

  resolveTicket = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const ticketId = String(req.params.id);
    const input = resolveComplaintTicketSchema.parse(req.body);
    const result = await this.service.resolveTicket(ticketId, actor.userId, input);
    res.json({ success: true, data: result });
  };

  // ============================================================== Moderator
  listModeratorTickets = async (req: Request, res: Response): Promise<void> => {
    const query = listComplaintsQuerySchema.parse(req.query);
    const result = await this.service.listModeratorTickets(query as any);
    res.json({ success: true, ...result });
  };

  adjudicateTicket = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const ticketId = String(req.params.id);
    const input = adjudicateComplaintTicketSchema.parse(req.body);
    const result = await this.service.adjudicateTicket(
      ticketId,
      { userId: actor.userId, role: actor.role },
      input,
    );
    res.json({ success: true, data: result });
  };

  getAgencyQualityDashboard = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.service.getAgencyQualityDashboard();
    res.json({ success: true, data: result });
  };

  // ================================================================== Shared
  getTicketDetail = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const ticketId = String(req.params.id);
    const result = await this.service.getTicketDetail(ticketId, {
      userId: actor.userId,
      role: actor.role,
    });
    res.json({ success: true, data: result });
  };

  sendMessage = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const ticketId = String(req.params.id);
    const input = sendComplaintMessageSchema.parse(req.body);
    const result = await this.service.sendMessage(
      ticketId,
      { userId: actor.userId, role: actor.role },
      input,
    );
    res.status(201).json({ success: true, data: result });
  };

  escalateTicket = async (req: Request, res: Response): Promise<void> => {
    const actor = userActor(req);
    const ticketId = String(req.params.id);
    const input = escalateComplaintTicketSchema.parse(req.body);
    const result = await this.service.escalateTicket(
      ticketId,
      { userId: actor.userId, role: actor.role },
      input,
    );
    res.json({ success: true, data: result });
  };
}

export const complaintsController = new ComplaintsController();
