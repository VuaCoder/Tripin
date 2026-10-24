import { randomUUID } from 'node:crypto';
import { createImageUploadSignature, verifyImageUpload } from '../../integrations/cloudinary';
import { AppError } from '../../utils/app-error';
import { buildPage, type Page } from '../../utils/pagination';
import { assertTransition } from '../../utils/state-machine';
import { bookingsService, type BookingsService } from '../bookings';
import { NOTIFICATION_TYPE, notificationsService, type NotificationsService } from '../notifications';
import { toursService, type ToursService } from '../tours';
import { usersService, type UsersService } from '../users';
import {
  COMPLAINT_LIMITS,
  COMPLAINT_TAXONOMY,
  COMPLAINT_TRANSITIONS,
  type AdjudicateComplaintTicketInput,
  type AgencyQualityStatsDto,
  type ComplaintFeedbackDto,
  type ComplaintTicketCategory,
  type ComplaintTicketDetailDto,
  type ComplaintTicketMessageDto,
  type ComplaintTicketPriority,
  type ComplaintTicketStatus,
  type ComplaintTicketSummaryDto,
  type CreateComplaintTicketInput,
  type EscalateComplaintTicketInput,
  type ListComplaintsQuery,
  type ResolveComplaintTicketInput,
  type SendComplaintMessageInput,
  type SubmitComplaintFeedbackInput,
} from './complaints.types';
import { complaintsRepository, type ComplaintsRepository, type ComplaintTicketWithRelations } from './complaints.repository';

export class ComplaintsService {
  constructor(
    private readonly repo: ComplaintsRepository = complaintsRepository,
    private readonly tours: Pick<ToursService, 'getTourFacts' | 'getTitles'> = toursService,
    private readonly bookings: Pick<BookingsService, 'getFacts'> = bookingsService,
    private readonly users: Pick<UsersService, 'getSummaries'> = usersService,
    private readonly notifications: Pick<NotificationsService, 'notify'> = notificationsService,
  ) {}

  // ---------------------------------------------------------------- Cloudinary
  createImageSignature(userId: string) {
    return createImageUploadSignature('complaintImage', `${userId}/${randomUUID()}`);
  }

  private async resolveUploadedImages(userId: string, ids?: string[]): Promise<string[]> {
    if (!ids || ids.length === 0) return [];
    if (ids.length > 5 || new Set(ids).size !== ids.length) {
      throw AppError.badRequest('Tối đa 5 ảnh đính kèm');
    }
    const prefix = `tripin/complaints/${userId}/`;
    if (ids.some((id) => !id.startsWith(prefix))) {
      throw AppError.forbidden('Ảnh bằng chứng phải thuộc về tài khoản của bạn');
    }
    const secureUrls: string[] = [];
    for (const id of ids) {
      const asset = await verifyImageUpload('complaintImage', id.slice('tripin/complaints/'.length), id);
      secureUrls.push(asset.secureUrl);
    }
    return secureUrls;
  }

  // ---------------------------------------------------------------- Traveler
  async createTicket(travelerId: string, input: CreateComplaintTicketInput): Promise<ComplaintTicketSummaryDto> {
    const tour = await this.tours.getTourFacts(input.tourId);
    if (!tour) throw AppError.notFound('Tour không tồn tại');
    const agencyId = tour.agencyId;

    if (input.bookingId) {
      const booking = await this.bookings.getFacts(input.bookingId);
      if (!booking || booking.travelerId !== travelerId || booking.tourId !== input.tourId) {
        throw AppError.notFound('Đơn đặt tour không hợp lệ hoặc không thuộc về bạn');
      }
    }

    const openDuplicate = await this.repo.findOpenDuplicate(travelerId, input.tourId);
    if (openDuplicate) {
      throw AppError.conflict(
        'Bạn đã có một phiếu khiếu nại đang xử lý cho tour này. Vui lòng tiếp tục trao đổi trên phiếu đó.',
        'COMPLAINT_ALREADY_OPEN',
      );
    }

    // Determine priority from taxonomy
    let priority: ComplaintTicketPriority = 'NORMAL';
    const categoryGroup = COMPLAINT_TAXONOMY.find((c: { id: string }) => c.id === input.category);
    if (categoryGroup) {
      const sub = categoryGroup.subCategories.find((s: { id: string; defaultPriority: ComplaintTicketPriority }) => s.id === input.subCategory);
      if (sub) priority = sub.defaultPriority;
    }
    if (input.category === 'SAFETY_URGENT') {
      priority = 'URGENT';
    }

    const attachments = await this.resolveUploadedImages(travelerId, input.imagePublicIds);
    const ticketCode = await this.repo.generateTicketCode();
    const created = await this.repo.create({
      ticketCode,
      travelerId,
      agencyId,
      tourId: input.tourId,
      bookingId: input.bookingId ?? null,
      category: input.category,
      subCategory: input.subCategory,
      subject: input.subject,
      description: input.description,
      priority,
      initialMessageText: input.description,
      attachments,
    });

    // Notify agency
    await this.notifications.notify(
      agencyId,
      {
        type: NOTIFICATION_TYPE.COMPLAINT_RECEIVED,
        title: 'Khiếu nại dịch vụ mới',
        body: `Có phiếu khiếu nại mới (${ticketCode}) về tour "${tour.title}". Vui lòng phản hồi sớm.`,
        data: { ticketId: created.id, ticketCode },
      },
      { email: true },
    );

    // Notify traveler confirmation
    await this.notifications.notify(
      travelerId,
      {
        type: NOTIFICATION_TYPE.COMPLAINT_RECEIVED,
        title: 'Đã tạo phiếu khiếu nại dịch vụ',
        body: `Phiếu khiếu nại ${ticketCode} về tour "${tour.title}" đã được ghi nhận. Bạn có thể theo dõi và trao đổi trong Hộp thư tin nhắn.`,
        data: { ticketId: created.id, ticketCode },
      },
      { email: false },
    );

    const summaries = await this.enrichSummaries([created]);
    return summaries[0]!;
  }

  async listTravelerTickets(travelerId: string, query: ListComplaintsQuery): Promise<Page<ComplaintTicketSummaryDto>> {
    const { items, total } = await this.repo.listByTraveler(
      travelerId,
      { status: query.status, category: query.category },
      { page: query.page, limit: query.limit },
    );
    const summaries = await this.enrichSummaries(items as ComplaintTicketWithRelations[]);
    return buildPage(summaries, total, query);
  }

  // ------------------------------------------------------------------ Agency
  async listAgencyTickets(agencyId: string, query: ListComplaintsQuery): Promise<Page<ComplaintTicketSummaryDto>> {
    const { items, total } = await this.repo.listByAgency(
      agencyId,
      { status: query.status, category: query.category, search: query.search },
      { page: query.page, limit: query.limit },
    );
    const summaries = await this.enrichSummaries(items as ComplaintTicketWithRelations[]);
    return buildPage(summaries, total, query);
  }

  // -------------------------------------------------------------- Moderator
  async listModeratorTickets(query: ListComplaintsQuery): Promise<Page<ComplaintTicketSummaryDto>> {
    const { items, total } = await this.repo.listForModeration(
      { status: query.status, category: query.category, search: query.search },
      { page: query.page, limit: query.limit },
    );
    const summaries = await this.enrichSummaries(items as ComplaintTicketWithRelations[]);
    return buildPage(summaries, total, query);
  }

  // ----------------------------------------------------------------- Shared
  async getTicketDetail(
    ticketId: string,
    actor: { userId: string; role: string },
  ): Promise<ComplaintTicketDetailDto> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) throw AppError.notFound('Phiếu khiếu nại không tồn tại');

    // Access check
    const isOwner = ticket.travelerId === actor.userId;
    const isAgency = ticket.agencyId === actor.userId;
    const isStaff = actor.role === 'MODERATOR' || actor.role === 'SUPER_ADMIN';
    if (!isOwner && !isAgency && !isStaff) {
      throw AppError.notFound('Phiếu khiếu nại không tồn tại');
    }

    const summaries = await this.enrichSummaries([ticket]);
    const summary = summaries[0]!;

    // Resolve sender names for messages
    const senderIds: string[] = Array.from(new Set(ticket.messages.map((m: { senderId: string }) => m.senderId)));
    const people = await this.users.getSummaries(senderIds);

    const messages: ComplaintTicketMessageDto[] = ticket.messages.map((m: {
      id: string;
      senderId: string;
      senderRole: string;
      text: string;
      attachments: string[];
      createdAt: Date;
    }) => {
      const person = people.get(m.senderId);
      const senderName = person ? (person.companyName ?? person.fullName) : undefined;
      return {
        id: m.id,
        senderId: m.senderId,
        senderRole: m.senderRole as 'TRAVELER' | 'AGENCY' | 'MODERATOR' | 'SYSTEM',
        senderName,
        text: m.text,
        attachments: m.attachments,
        createdAt: m.createdAt.toISOString(),
      };
    });

    const feedbackDto: ComplaintFeedbackDto | null = ticket.feedback
      ? {
          id: ticket.feedback.id,
          rating: ticket.feedback.rating,
          speedScore: ticket.feedback.speedScore,
          attitudeScore: ticket.feedback.attitudeScore,
          satisfactionScore: ticket.feedback.satisfactionScore,
          comment: ticket.feedback.comment,
          createdAt: ticket.feedback.createdAt.toISOString(),
        }
      : null;

    return {
      ...summary,
      description: ticket.description,
      messages,
      feedback: feedbackDto,
    };
  }

  async sendMessage(
    ticketId: string,
    actor: { userId: string; role: string },
    input: SendComplaintMessageInput,
  ): Promise<ComplaintTicketMessageDto> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) throw AppError.notFound('Phiếu khiếu nại không tồn tại');

    const isTraveler = ticket.travelerId === actor.userId;
    const isAgency = ticket.agencyId === actor.userId;
    const isStaff = actor.role === 'MODERATOR' || actor.role === 'SUPER_ADMIN';

    if (!isTraveler && !isAgency && !isStaff) {
      throw AppError.notFound('Phiếu khiếu nại không tồn tại');
    }

    if (ticket.status === 'CLOSED') {
      throw AppError.badRequest('Phiếu khiếu nại này đã đóng, không thể gửi thêm tin nhắn', 'TICKET_CLOSED');
    }

    if (ticket.messages.length >= COMPLAINT_LIMITS.MAX_MESSAGES_PER_TICKET) {
      throw AppError.conflict('Cuộc hội thoại đã đạt giới hạn tối đa số lượng tin nhắn', 'TICKET_FULL');
    }

    let nextStatus: ComplaintTicketStatus | undefined;
    let isFirstAgencyResponse = false;

    if (isAgency) {
      if (ticket.status === 'OPEN') {
        nextStatus = 'IN_PROGRESS';
        isFirstAgencyResponse = !ticket.firstResponseAt;
      }
    } else if (isTraveler) {
      // If ticket was resolved and traveler sends a message, they reject the resolution -> reopen to IN_PROGRESS
      if (ticket.status === 'RESOLVED') {
        nextStatus = 'IN_PROGRESS';
      }
    }

    const senderRole = isTraveler ? 'TRAVELER' : isAgency ? 'AGENCY' : isStaff ? 'MODERATOR' : 'SYSTEM';
    const attachments = await this.resolveUploadedImages(actor.userId, input.imagePublicIds);

    const { message } = await this.repo.appendMessage({
      ticketId,
      senderId: actor.userId,
      senderRole,
      text: input.text,
      attachments,
      isFirstAgencyResponse,
      nextStatus,
    });

    // Notify counterpart
    const targetUserId = isTraveler ? ticket.agencyId : ticket.travelerId;
    await this.notifications.notify(targetUserId, {
      type: NOTIFICATION_TYPE.COMPLAINT_MESSAGE,
      title: 'Tin nhắn mới trong phiếu khiếu nại',
      body: `Có phản hồi mới trong phiếu ${ticket.ticketCode}: "${input.text.slice(0, 80)}${input.text.length > 80 ? '...' : ''}"`,
      data: { ticketId: ticket.id, ticketCode: ticket.ticketCode },
    });

    return {
      id: message.id,
      senderId: message.senderId,
      senderRole: message.senderRole as 'TRAVELER' | 'AGENCY' | 'MODERATOR' | 'SYSTEM',
      text: message.text,
      attachments: message.attachments,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async resolveTicket(
    ticketId: string,
    agencyId: string,
    input: ResolveComplaintTicketInput,
  ): Promise<ComplaintTicketDetailDto> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket || ticket.agencyId !== agencyId) throw AppError.notFound('Phiếu khiếu nại không tồn tại');

    assertTransition(COMPLAINT_TRANSITIONS, ticket.status as ComplaintTicketStatus, 'RESOLVED', 'ComplaintTicket');

    const updated = await this.repo.updateStatus(ticketId, ['OPEN', 'IN_PROGRESS'], {
      status: 'RESOLVED',
      solutionSummary: input.solutionSummary,
      resolvedAt: new Date(),
    });
    if (!updated) throw AppError.conflict('Phiếu đã thay đổi trạng thái, vui lòng tải lại', 'CONCURRENT_UPDATE');

    // Add a system event message
    await this.repo.appendMessage({
      ticketId,
      senderId: agencyId,
      senderRole: 'SYSTEM',
      text: `Đối tác đã đề xuất giải pháp xử lý: "${input.solutionSummary}". Vui lòng xác nhận giải pháp để đóng phiếu.`,
    });

    // Notify traveler
    await this.notifications.notify(
      ticket.travelerId,
      {
        type: NOTIFICATION_TYPE.COMPLAINT_RESOLVED,
        title: 'Đối tác đã đề xuất giải pháp cho khiếu nại',
        body: `Đối tác đã xử lý phiếu ${ticket.ticketCode}: "${input.solutionSummary}". Vui lòng xác nhận để hoàn tất.`,
        data: { ticketId, ticketCode: ticket.ticketCode },
      },
      { email: true },
    );

    return this.getTicketDetail(ticketId, { userId: agencyId, role: 'AGENCY' });
  }

  async acceptResolution(
    ticketId: string,
    travelerId: string,
  ): Promise<ComplaintTicketDetailDto> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket || ticket.travelerId !== travelerId) throw AppError.notFound('Phiếu khiếu nại không tồn tại');

    assertTransition(COMPLAINT_TRANSITIONS, ticket.status as ComplaintTicketStatus, 'CLOSED', 'ComplaintTicket');

    const updated = await this.repo.updateStatus(ticketId, ['RESOLVED'], {
      status: 'CLOSED',
      closedAt: new Date(),
    });
    if (!updated) throw AppError.conflict('Phiếu đã thay đổi trạng thái, vui lòng tải lại', 'CONCURRENT_UPDATE');

    // Add system message
    await this.repo.appendMessage({
      ticketId,
      senderId: travelerId,
      senderRole: 'SYSTEM',
      text: 'Khách hàng đã chấp nhận giải pháp và đóng phiếu. Khảo sát chất lượng hỗ trợ đã được gửi.',
    });

    // Prompt traveler for CSAT feedback
    await this.notifications.notify(travelerId, {
      type: NOTIFICATION_TYPE.COMPLAINT_FEEDBACK_REQUESTED,
      title: 'Đánh giá chất lượng hỗ trợ',
      body: `Phiếu ${ticket.ticketCode} đã đóng. Hãy đánh giá chất lượng phục vụ của đối tác để giúp nâng cao dịch vụ.`,
      data: { ticketId, ticketCode: ticket.ticketCode },
    });

    // Inform agency
    await this.notifications.notify(ticket.agencyId, {
      type: NOTIFICATION_TYPE.COMPLAINT_RESOLVED,
      title: 'Phiếu khiếu nại đã đóng thành công',
      body: `Khách hàng đã chấp nhận giải pháp và đóng phiếu ${ticket.ticketCode}.`,
      data: { ticketId, ticketCode: ticket.ticketCode },
    });

    return this.getTicketDetail(ticketId, { userId: travelerId, role: 'TRAVELER' });
  }

  async escalateTicket(
    ticketId: string,
    actor: { userId: string; role: string },
    input: EscalateComplaintTicketInput,
  ): Promise<ComplaintTicketDetailDto> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) throw AppError.notFound('Phiếu khiếu nại không tồn tại');

    const isTraveler = ticket.travelerId === actor.userId;
    const isAgency = ticket.agencyId === actor.userId;
    if (!isTraveler && !isAgency) throw AppError.notFound('Phiếu khiếu nại không tồn tại');

    assertTransition(COMPLAINT_TRANSITIONS, ticket.status as ComplaintTicketStatus, 'ESCALATED', 'ComplaintTicket');

    const updated = await this.repo.updateStatus(ticketId, ['OPEN', 'IN_PROGRESS', 'RESOLVED'], {
      status: 'ESCALATED',
      escalatedAt: new Date(),
    });
    if (!updated) throw AppError.conflict('Phiếu đã thay đổi trạng thái, vui lòng tải lại', 'CONCURRENT_UPDATE');

    const who = isTraveler ? 'Du khách' : 'Đối tác';
    await this.repo.appendMessage({
      ticketId,
      senderId: actor.userId,
      senderRole: 'SYSTEM',
      text: `${who} đã yêu cầu Sàn can thiệp (Leo thang vụ việc). Lý do: "${input.reason}". Kiểm duyệt viên sẽ phân xử và ra phán quyết cuối cùng.`,
    });

    // Notify both parties
    const notice = {
      type: NOTIFICATION_TYPE.COMPLAINT_ESCALATED,
      title: 'Khiếu nại được chuyển đến Kiểm duyệt viên sàn',
      body: `Phiếu ${ticket.ticketCode} đã được chuyển tới Kiểm duyệt viên để làm trọng tài phân xử.`,
      data: { ticketId, ticketCode: ticket.ticketCode },
    };
    await Promise.all([
      this.notifications.notify(ticket.travelerId, notice),
      this.notifications.notify(ticket.agencyId, notice),
    ]);

    return this.getTicketDetail(ticketId, actor);
  }

  async adjudicateTicket(
    ticketId: string,
    moderator: { userId: string; role: string },
    input: AdjudicateComplaintTicketInput,
  ): Promise<ComplaintTicketDetailDto> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) throw AppError.notFound('Phiếu khiếu nại không tồn tại');

    assertTransition(COMPLAINT_TRANSITIONS, ticket.status as ComplaintTicketStatus, 'CLOSED', 'ComplaintTicket');

    const updated = await this.repo.updateStatus(ticketId, ['ESCALATED'], {
      status: 'CLOSED',
      moderatorDecision: `${input.decision}: ${input.note}`,
      closedAt: new Date(),
    });
    if (!updated) throw AppError.conflict('Phiếu đã thay đổi trạng thái, vui lòng tải lại', 'CONCURRENT_UPDATE');

    await this.repo.appendMessage({
      ticketId,
      senderId: moderator.userId,
      senderRole: 'SYSTEM',
      text: `Kiểm duyệt viên sàn đã đưa ra phán quyết cuối cùng: ${input.decision}. Ghi chú: ${input.note}. Phiếu khiếu nại chính thức đóng.`,
    });

    const decisionNotice = {
      type: NOTIFICATION_TYPE.COMPLAINT_RESOLVED,
      title: 'Phán quyết từ Kiểm duyệt viên sàn',
      body: `Kiểm duyệt viên đã phán quyết cho phiếu ${ticket.ticketCode}: ${input.decision}.`,
      data: { ticketId, ticketCode: ticket.ticketCode },
    };
    await Promise.all([
      this.notifications.notify(ticket.travelerId, decisionNotice, { email: true }),
      this.notifications.notify(ticket.agencyId, decisionNotice, { email: true }),
    ]);

    return this.getTicketDetail(ticketId, moderator);
  }

  async submitFeedback(
    ticketId: string,
    travelerId: string,
    input: SubmitComplaintFeedbackInput,
  ): Promise<ComplaintFeedbackDto> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket || ticket.travelerId !== travelerId) throw AppError.notFound('Phiếu khiếu nại không tồn tại');

    if (ticket.status !== 'CLOSED') {
      throw AppError.badRequest('Chỉ có thể đánh giá sau khi phiếu khiếu nại đã đóng', 'TICKET_NOT_CLOSED');
    }

    if (ticket.feedback) {
      throw AppError.conflict('Bạn đã gửi đánh giá cho phiếu khiếu nại này rồi', 'FEEDBACK_EXISTS');
    }

    const created = await this.repo.createFeedback({
      ticketId,
      agencyId: ticket.agencyId,
      travelerId,
      rating: input.rating,
      speedScore: input.speedScore,
      attitudeScore: input.attitudeScore,
      satisfactionScore: input.satisfactionScore,
      comment: input.comment,
    });

    return {
      id: created.id,
      rating: created.rating,
      speedScore: created.speedScore,
      attitudeScore: created.attitudeScore,
      satisfactionScore: created.satisfactionScore,
      comment: created.comment,
      createdAt: created.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------- Dashboard & Analytics
  async getAgencyQualityDashboard(): Promise<AgencyQualityStatsDto[]> {
    const { stats, feedbacks } = await this.repo.getAgencyQualityAggregates();

    // Collect all agency IDs
    const agencyIds = Array.from(
      new Set([...stats.map((s) => s.agencyId), ...feedbacks.map((f) => f.agencyId)]),
    );
    const people = await this.users.getSummaries(agencyIds);

    const feedbackMap = new Map(feedbacks.map((f) => [f.agencyId, f]));

    return agencyIds.map((agencyId) => {
      const person = people.get(agencyId);
      const agencyName = person ? (person.companyName ?? person.fullName) : 'Đại lý';

      const agencyStats = stats.filter((s) => s.agencyId === agencyId);
      const totalComplaints = agencyStats.reduce((sum, s) => sum + s._count.id, 0);
      const resolvedCount = agencyStats.find((s) => s.status === 'RESOLVED')?._count.id ?? 0;
      const closedCount = agencyStats.find((s) => s.status === 'CLOSED')?._count.id ?? 0;
      const escalatedCount = agencyStats.find((s) => s.status === 'ESCALATED')?._count.id ?? 0;

      const fb = feedbackMap.get(agencyId);
      const avgRating = Number(fb?._avg.rating?.toFixed(2) ?? 0);
      const avgSpeedScore = Number(fb?._avg.speedScore?.toFixed(2) ?? 0);
      const avgAttitudeScore = Number(fb?._avg.attitudeScore?.toFixed(2) ?? 0);
      const avgSatisfactionScore = Number(fb?._avg.satisfactionScore?.toFixed(2) ?? 0);
      const totalFeedbacks = fb?._count.id ?? 0;

      const resolutionRatePercent =
        totalComplaints > 0 ? Math.round(((closedCount + resolvedCount) / totalComplaints) * 100) : 100;

      return {
        agencyId,
        agencyName,
        totalComplaints,
        resolvedCount,
        closedCount,
        escalatedCount,
        avgRating,
        avgSpeedScore,
        avgAttitudeScore,
        avgSatisfactionScore,
        totalFeedbacks,
        resolutionRatePercent,
      };
    });
  }

  // ----------------------------------------------------------- Background Job
  async autoCloseResolvedTickets(): Promise<number> {
    const cutoff = new Date(Date.now() - COMPLAINT_LIMITS.AUTO_CLOSE_HOURS * 3600 * 1000);
    const stale = await this.repo.findStaleResolved(cutoff);

    for (const ticket of stale) {
      await this.repo.updateStatus(ticket.id, ['RESOLVED'], {
        status: 'CLOSED',
        closedAt: new Date(),
      });
      await this.repo.appendMessage({
        ticketId: ticket.id,
        senderId: ticket.travelerId,
        senderRole: 'SYSTEM',
        text: 'Hệ thống tự động đóng phiếu sau 72 giờ không có phản hồi mới. Vui lòng dành chút thời gian đánh giá dịch vụ hỗ trợ.',
      });
      await this.notifications.notify(ticket.travelerId, {
        type: NOTIFICATION_TYPE.COMPLAINT_FEEDBACK_REQUESTED,
        title: 'Đánh giá chất lượng hỗ trợ',
        body: `Phiếu ${ticket.ticketCode} đã tự động đóng. Vui lòng đánh giá chất lượng phục vụ của đối tác.`,
        data: { ticketId: ticket.id, ticketCode: ticket.ticketCode },
      });
    }
    return stale.length;
  }

  // ------------------------------------------------------------------ Helpers
  private async enrichSummaries(items: ComplaintTicketWithRelations[]): Promise<ComplaintTicketSummaryDto[]> {
    if (items.length === 0) return [];

    const tourIds = Array.from(new Set(items.map((i) => i.tourId)));
    const userIds = Array.from(new Set(items.flatMap((i) => [i.travelerId, i.agencyId])));
    const bookingIds = Array.from(new Set(items.flatMap((i) => (i.bookingId ? [i.bookingId] : []))));

    const [titles, people, bookings] = await Promise.all([
      this.tours.getTitles(tourIds),
      this.users.getSummaries(userIds),
      Promise.all(bookingIds.map((id) => this.bookings.getFacts(id))),
    ]);

    const bookingCodes = new Map(
      bookings.flatMap((b) => (b ? [[b.id, b.bookingCode] as const] : [])),
    );

    return items.map((t) => {
      const traveler = people.get(t.travelerId);
      const agency = people.get(t.agencyId);
      return {
        id: t.id,
        ticketCode: t.ticketCode,
        tourId: t.tourId,
        tourTitle: titles.get(t.tourId),
        bookingId: t.bookingId,
        bookingCode: t.bookingId ? bookingCodes.get(t.bookingId) : undefined,
        travelerId: t.travelerId,
        travelerName: traveler?.fullName,
        agencyId: t.agencyId,
        agencyName: agency?.companyName ?? agency?.fullName,
        category: t.category as ComplaintTicketCategory,
        subCategory: t.subCategory,
        subject: t.subject,
        status: t.status as ComplaintTicketStatus,
        priority: t.priority as ComplaintTicketPriority,
        solutionSummary: t.solutionSummary,
        moderatorDecision: t.moderatorDecision,
        messageCount: t.messages?.length ?? 0,
        lastMessageAt: t.lastMessageAt.toISOString(),
        resolvedAt: t.resolvedAt?.toISOString() ?? null,
        closedAt: t.closedAt?.toISOString() ?? null,
        escalatedAt: t.escalatedAt?.toISOString() ?? null,
        hasFeedback: !!t.feedback,
        rating: t.feedback?.rating ?? null,
        createdAt: t.createdAt.toISOString(),
      };
    });
  }
}

export const complaintsService = new ComplaintsService();
