import { prisma, type Prisma } from '../../config/database';
import type { ComplaintTicketCategory, ComplaintTicketPriority, ComplaintTicketStatus } from './complaints.types';

export type ComplaintTicketWithRelations = Prisma.ComplaintTicketGetPayload<{
  include: {
    messages: true;
    feedback: true;
  };
}>;

export class ComplaintsRepository {
  async generateTicketCode(): Promise<string> {
    const today = new Date();
    const ymd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.complaintTicket.count({
      where: {
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        },
      },
    });
    const suffix = String(count + 1).padStart(4, '0');
    return `CP-${ymd}-${suffix}`;
  }

  async create(data: {
    ticketCode: string;
    travelerId: string;
    agencyId: string;
    tourId: string;
    bookingId?: string | null;
    category: ComplaintTicketCategory;
    subCategory: string;
    subject: string;
    description: string;
    priority: ComplaintTicketPriority;
    initialMessageText: string;
    attachments?: string[];
  }): Promise<ComplaintTicketWithRelations> {
    return prisma.complaintTicket.create({
      data: {
        ticketCode: data.ticketCode,
        travelerId: data.travelerId,
        agencyId: data.agencyId,
        tourId: data.tourId,
        bookingId: data.bookingId,
        category: data.category,
        subCategory: data.subCategory,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        messages: {
          create: {
            senderId: data.travelerId,
            senderRole: 'TRAVELER',
            text: data.initialMessageText,
            attachments: data.attachments ?? [],
          },
        },
      },
      include: {
        messages: true,
        feedback: true,
      },
    });
  }

  async findById(id: string): Promise<ComplaintTicketWithRelations | null> {
    return prisma.complaintTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        feedback: true,
      },
    });
  }

  async findOpenDuplicate(travelerId: string, tourId: string): Promise<ComplaintTicketWithRelations | null> {
    return prisma.complaintTicket.findFirst({
      where: {
        travelerId,
        tourId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED'] },
      },
      include: {
        messages: true,
        feedback: true,
      },
    });
  }

  async listByTraveler(
    travelerId: string,
    filter: { status?: ComplaintTicketStatus; category?: ComplaintTicketCategory },
    page: { page: number; limit: number },
  ) {
    const where: Prisma.ComplaintTicketWhereInput = {
      travelerId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.category ? { category: filter.category } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.complaintTicket.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page.page - 1) * page.limit,
        take: page.limit,
        include: {
          messages: { select: { id: true } },
          feedback: true,
        },
      }),
      prisma.complaintTicket.count({ where }),
    ]);
    return { items, total };
  }

  async listByAgency(
    agencyId: string,
    filter: { status?: ComplaintTicketStatus; category?: ComplaintTicketCategory; search?: string },
    page: { page: number; limit: number },
  ) {
    const where: Prisma.ComplaintTicketWhereInput = {
      agencyId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.search
        ? {
            OR: [
              { ticketCode: { contains: filter.search, mode: 'insensitive' } },
              { subject: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.complaintTicket.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { lastMessageAt: 'desc' }],
        skip: (page.page - 1) * page.limit,
        take: page.limit,
        include: {
          messages: { select: { id: true } },
          feedback: true,
        },
      }),
      prisma.complaintTicket.count({ where }),
    ]);
    return { items, total };
  }

  async listForModeration(
    filter: { status?: ComplaintTicketStatus; category?: ComplaintTicketCategory; search?: string },
    page: { page: number; limit: number },
  ) {
    const where: Prisma.ComplaintTicketWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.search
        ? {
            OR: [
              { ticketCode: { contains: filter.search, mode: 'insensitive' } },
              { subject: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.complaintTicket.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page.page - 1) * page.limit,
        take: page.limit,
        include: {
          messages: { select: { id: true } },
          feedback: true,
        },
      }),
      prisma.complaintTicket.count({ where }),
    ]);
    return { items, total };
  }

  async appendMessage(data: {
    ticketId: string;
    senderId: string;
    senderRole: 'TRAVELER' | 'AGENCY' | 'MODERATOR' | 'SYSTEM';
    text: string;
    attachments?: string[];
    isFirstAgencyResponse?: boolean;
    nextStatus?: ComplaintTicketStatus;
  }) {
    const [message, updatedTicket] = await prisma.$transaction([
      prisma.complaintTicketMessage.create({
        data: {
          ticketId: data.ticketId,
          senderId: data.senderId,
          senderRole: data.senderRole,
          text: data.text,
          attachments: data.attachments ?? [],
        },
      }),
      prisma.complaintTicket.update({
        where: { id: data.ticketId },
        data: {
          lastMessageAt: new Date(),
          ...(data.isFirstAgencyResponse ? { firstResponseAt: new Date() } : {}),
          ...(data.nextStatus ? { status: data.nextStatus } : {}),
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          feedback: true,
        },
      }),
    ]);
    return { message, updatedTicket };
  }

  async updateStatus(
    id: string,
    expectedStatuses: ComplaintTicketStatus[],
    data: {
      status: ComplaintTicketStatus;
      solutionSummary?: string | null;
      moderatorDecision?: string | null;
      resolvedAt?: Date | null;
      closedAt?: Date | null;
      escalatedAt?: Date | null;
    },
  ) {
    const existing = await prisma.complaintTicket.findUnique({ where: { id } });
    if (!existing || !expectedStatuses.includes(existing.status as ComplaintTicketStatus)) {
      return null;
    }
    return prisma.complaintTicket.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.solutionSummary !== undefined ? { solutionSummary: data.solutionSummary } : {}),
        ...(data.moderatorDecision !== undefined ? { moderatorDecision: data.moderatorDecision } : {}),
        ...(data.resolvedAt !== undefined ? { resolvedAt: data.resolvedAt } : {}),
        ...(data.closedAt !== undefined ? { closedAt: data.closedAt } : {}),
        ...(data.escalatedAt !== undefined ? { escalatedAt: data.escalatedAt } : {}),
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        feedback: true,
      },
    });
  }

  async createFeedback(data: {
    ticketId: string;
    agencyId: string;
    travelerId: string;
    rating: number;
    speedScore?: number;
    attitudeScore?: number;
    satisfactionScore?: number;
    comment?: string;
  }) {
    return prisma.complaintFeedback.create({
      data: {
        ticketId: data.ticketId,
        agencyId: data.agencyId,
        travelerId: data.travelerId,
        rating: data.rating,
        speedScore: data.speedScore ?? 5,
        attitudeScore: data.attitudeScore ?? 5,
        satisfactionScore: data.satisfactionScore ?? 5,
        comment: data.comment,
      },
    });
  }

  async findStaleResolved(cutoff: Date) {
    return prisma.complaintTicket.findMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: { lte: cutoff },
      },
    });
  }

  async getAgencyQualityAggregates() {
    const stats = await prisma.complaintTicket.groupBy({
      by: ['agencyId', 'status'],
      _count: { id: true },
    });
    const feedbacks = await prisma.complaintFeedback.groupBy({
      by: ['agencyId'],
      _avg: {
        rating: true,
        speedScore: true,
        attitudeScore: true,
        satisfactionScore: true,
      },
      _count: { id: true },
    });
    return { stats, feedbacks };
  }
}

export const complaintsRepository = new ComplaintsRepository();
