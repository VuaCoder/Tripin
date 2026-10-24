import { describe, expect, it, vi } from 'vitest';
import { ComplaintsService } from '../complaints.service';
import type { ComplaintTicketWithRelations } from '../complaints.repository';

vi.mock('../../../integrations/cloudinary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../integrations/cloudinary')>()),
  verifyImageUpload: vi.fn(async (_purpose, _owner, publicId) => ({
    publicId,
    secureUrl: `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`,
  })),
  createImageUploadSignature: vi.fn((_purpose, userId) => ({
    cloudName: 'test',
    apiKey: 'key',
    timestamp: 1234567890,
    signature: 'sig',
    publicId: `tripin/complaints/${userId}`,
    uploadUrl: 'https://api.cloudinary.com/v1_1/test/image/upload',
    params: { public_id: `tripin/complaints/${userId}`, overwrite: 'false', tags: 'tripin_complaint' },
  })),
}));

type T = Record<string, any>;

function mockTicket(over: T = {}): ComplaintTicketWithRelations {
  return {
    id: 'c1',
    ticketCode: 'CP-20261022-0001',
    travelerId: 'u_traveler',
    agencyId: 'u_agency',
    tourId: 't1',
    bookingId: 'b1',
    category: 'ITINERARY',
    subCategory: 'ITINERARY_SKIPPED_ATTRACTION',
    subject: 'Bỏ sót điểm tham quan chùa Bái Đính',
    description: 'Hướng dẫn viên bỏ qua điểm này không lý do.',
    status: 'OPEN',
    priority: 'NORMAL',
    solutionSummary: null,
    moderatorDecision: null,
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    escalatedAt: null,
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [
      {
        id: 'm1',
        ticketId: 'c1',
        senderId: 'u_traveler',
        senderRole: 'TRAVELER',
        text: 'Hướng dẫn viên bỏ qua điểm này không lý do.',
        attachments: [],
        createdAt: new Date(),
      },
    ],
    feedback: null,
    ...over,
  } as any;
}

function createMockService(initialTickets: ComplaintTicketWithRelations[] = []) {
  const db: ComplaintTicketWithRelations[] = [...initialTickets];

  const repo: any = {
    generateTicketCode: vi.fn(async () => `CP-20261022-000${db.length + 1}`),
    create: vi.fn(async (data: any) => {
      const doc = mockTicket({
        ...data,
        id: `c${db.length + 1}`,
        status: 'OPEN',
        messages: [
          {
            id: 'm1',
            ticketId: `c${db.length + 1}`,
            senderId: data.travelerId,
            senderRole: 'TRAVELER',
            text: data.initialMessageText,
            attachments: data.attachments ?? [],
            createdAt: new Date(),
          },
        ],
      });
      db.push(doc);
      return doc;
    }),
    findById: vi.fn(async (id: string) => db.find((t) => t.id === id) ?? null),
    findOpenDuplicate: vi.fn(async (travelerId: string, tourId: string) =>
      db.find((t) => t.travelerId === travelerId && t.tourId === tourId && t.status !== 'CLOSED') ?? null,
    ),
    listByTraveler: vi.fn(async () => ({ items: db, total: db.length })),
    listByAgency: vi.fn(async () => ({ items: db, total: db.length })),
    listForModeration: vi.fn(async () => ({ items: db, total: db.length })),
    appendMessage: vi.fn(async (data: any) => {
      const doc = db.find((t) => t.id === data.ticketId);
      if (!doc) return null;
      const msg = {
        id: `m${doc.messages.length + 1}`,
        ticketId: data.ticketId,
        senderId: data.senderId,
        senderRole: data.senderRole,
        text: data.text,
        attachments: data.attachments ?? [],
        createdAt: new Date(),
      };
      doc.messages.push(msg);
      if (data.nextStatus) doc.status = data.nextStatus;
      if (data.isFirstAgencyResponse) doc.firstResponseAt = new Date();
      doc.lastMessageAt = new Date();
      return { message: msg, updatedTicket: doc };
    }),
    updateStatus: vi.fn(async (id: string, expected: string[], patch: any) => {
      const doc = db.find((t) => t.id === id);
      if (!doc || !expected.includes(doc.status)) return null;
      Object.assign(doc, patch);
      return doc;
    }),
    createFeedback: vi.fn(async (data: any) => {
      const doc = db.find((t) => t.id === data.ticketId);
      const fb = { id: 'fb1', createdAt: new Date(), ...data };
      if (doc) doc.feedback = fb;
      return fb;
    }),
    getAgencyQualityAggregates: vi.fn(async () => ({
      stats: [
        { agencyId: 'u_agency', status: 'CLOSED', _count: { id: 3 } },
        { agencyId: 'u_agency', status: 'ESCALATED', _count: { id: 1 } },
      ],
      feedbacks: [
        {
          agencyId: 'u_agency',
          _avg: { rating: 4.5, speedScore: 4.8, attitudeScore: 4.2, satisfactionScore: 4.5 },
          _count: { id: 2 },
        },
      ],
    })),
  };

  const tours: any = {
    getTourFacts: vi.fn(async (id: string) => (id === 't1' ? { id: 't1', title: 'Ninh Bình 1 Ngày', agencyId: 'u_agency' } : null)),
    getTitles: vi.fn(async () => new Map([['t1', 'Ninh Bình 1 Ngày']])),
  };

  const bookings: any = {
    getFacts: vi.fn(async (id: string) =>
      id === 'b1' ? { id: 'b1', travelerId: 'u_traveler', tourId: 't1', bookingCode: 'BK123' } : null,
    ),
  };

  const users: any = {
    getSummaries: vi.fn(
      async () =>
        new Map([
          ['u_traveler', { id: 'u_traveler', fullName: 'Nguyễn Văn Khách' }],
          ['u_agency', { id: 'u_agency', companyName: 'Vietraveler Corp', fullName: 'Đại lý' }],
          ['u_mod', { id: 'u_mod', fullName: 'Kiểm duyệt viên sàn' }],
        ]),
    ),
  };

  const notifications: any = {
    notify: vi.fn(async () => {}),
  };

  const service = new ComplaintsService(repo, tours, bookings, users, notifications);
  return { service, repo, notifications };
}

describe('ComplaintsService', () => {
  it('tạo phiếu khiếu nại thành công và thông báo cho agency', async () => {
    const { service, notifications } = createMockService();

    const created = await service.createTicket('u_traveler', {
      tourId: 't1',
      bookingId: 'b1',
      category: 'ITINERARY',
      subCategory: 'ITINERARY_SKIPPED_ATTRACTION',
      subject: 'Bỏ sót điểm tham quan chùa Bái Đính',
      description: 'Hướng dẫn viên bỏ qua điểm này không lý do.',
    });

    expect(created.ticketCode).toBe('CP-20261022-0001');
    expect(created.status).toBe('OPEN');
    expect(created.agencyId).toBe('u_agency');
    expect(notifications.notify).toHaveBeenCalledWith('u_agency', expect.objectContaining({ type: 'COMPLAINT_RECEIVED' }), { email: true });
  });

  it('chặn gửi trùng khi đã có phiếu đang mở cho cùng một tour', async () => {
    const existing = mockTicket();
    const { service } = createMockService([existing]);

    await expect(
      service.createTicket('u_traveler', {
        tourId: 't1',
        category: 'ITINERARY',
        subCategory: 'ITINERARY_SKIPPED_ATTRACTION',
        subject: 'Khiếu nại lần 2',
        description: 'Vẫn là vấn đề cũ chưa xong',
      }),
    ).rejects.toThrow('Bạn đã có một phiếu khiếu nại đang xử lý cho tour này');
  });

  it('agency gửi tin nhắn chuyển trạng thái từ OPEN sang IN_PROGRESS và ghi nhận firstResponseAt', async () => {
    const ticket = mockTicket({ status: 'OPEN', firstResponseAt: null });
    const { service, repo, notifications } = createMockService([ticket]);

    const msg = await service.sendMessage(ticket.id, { userId: 'u_agency', role: 'AGENCY' }, {
      text: 'Chào bạn, chúng tôi đã tiếp nhận và đang liên hệ điều hành xe.',
    });

    expect(msg.senderRole).toBe('AGENCY');
    expect(repo.appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        isFirstAgencyResponse: true,
        nextStatus: 'IN_PROGRESS',
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith('u_traveler', expect.objectContaining({ type: 'COMPLAINT_MESSAGE' }));
  });

  it('agency đề xuất giải pháp xử lý phiếu thành công (RESOLVED)', async () => {
    const ticket = mockTicket({ status: 'IN_PROGRESS' });
    const { service, notifications } = createMockService([ticket]);

    const resolved = await service.resolveTicket(ticket.id, 'u_agency', {
      solutionSummary: 'Hoàn lại 20% tiền vé và tặng voucher 100k',
    });

    expect(resolved.status).toBe('RESOLVED');
    expect(notifications.notify).toHaveBeenCalledWith(
      'u_traveler',
      expect.objectContaining({ type: 'COMPLAINT_RESOLVED' }),
      { email: true },
    );
  });

  it('du khách chấp nhận giải pháp và đóng phiếu (CLOSED), kích hoạt lời mời đánh giá CSAT', async () => {
    const ticket = mockTicket({ status: 'RESOLVED' });
    const { service, notifications } = createMockService([ticket]);

    const closed = await service.acceptResolution(ticket.id, 'u_traveler');
    expect(closed.status).toBe('CLOSED');
    expect(notifications.notify).toHaveBeenCalledWith(
      'u_traveler',
      expect.objectContaining({ type: 'COMPLAINT_FEEDBACK_REQUESTED' }),
    );
  });

  it('leo thang (ESCALATE) lên Kiểm duyệt viên sàn khi hai bên bất đồng', async () => {
    const ticket = mockTicket({ status: 'IN_PROGRESS' });
    const { service, notifications } = createMockService([ticket]);

    const escalated = await service.escalateTicket(ticket.id, { userId: 'u_traveler', role: 'TRAVELER' }, {
      reason: 'Đại lý từ chối bồi thường thỏa đáng, đề nghị Sàn phân xử.',
    });

    expect(escalated.status).toBe('ESCALATED');
    expect(notifications.notify).toHaveBeenCalledWith('u_agency', expect.objectContaining({ type: 'COMPLAINT_ESCALATED' }));
  });

  it('kiểm duyệt viên sàn đưa ra phán quyết đóng vụ việc leo thang', async () => {
    const ticket = mockTicket({ status: 'ESCALATED' });
    const { service, notifications } = createMockService([ticket]);

    const adjudicated = await service.adjudicateTicket(
      ticket.id,
      { userId: 'u_mod', role: 'MODERATOR' },
      { decision: 'Chấp nhận khiếu nại của khách', note: 'Buộc đại lý hoàn 50% chi phí' },
    );

    expect(adjudicated.status).toBe('CLOSED');
    expect(notifications.notify).toHaveBeenCalledWith(
      'u_traveler',
      expect.objectContaining({ type: 'COMPLAINT_RESOLVED' }),
      { email: true },
    );
  });

  it('du khách gửi đánh giá CSAT sau khi phiếu đóng', async () => {
    const ticket = mockTicket({ status: 'CLOSED' });
    const { service } = createMockService([ticket]);

    const feedback = await service.submitFeedback(ticket.id, 'u_traveler', {
      rating: 5,
      speedScore: 5,
      attitudeScore: 4,
      satisfactionScore: 5,
      comment: 'Hỗ trợ giải quyết rất nhanh và nhiệt tình!',
    });

    expect(feedback.rating).toBe(5);
    expect(feedback.comment).toBe('Hỗ trợ giải quyết rất nhanh và nhiệt tình!');
  });

  it('tính toán đúng Dashboard thống kê chất lượng Agency cho Moderator', async () => {
    const { service } = createMockService();

    const dashboard = await service.getAgencyQualityDashboard();
    expect(dashboard).toHaveLength(1);
    expect(dashboard[0]!.agencyName).toBe('Vietraveler Corp');
    expect(dashboard[0]!.avgRating).toBe(4.5);
    expect(dashboard[0]!.totalComplaints).toBe(4);
    expect(dashboard[0]!.resolutionRatePercent).toBe(75);
  });

  it('tạo upload signature cho hình ảnh bằng chứng khiếu nại', () => {
    const { service } = createMockService();
    const sig = service.createImageSignature('u_traveler');
    expect(sig.publicId).toContain('tripin/complaints/u_traveler');
  });

  it('xác thực và đính kèm ảnh Cloudinary khi mở phiếu khiếu nại', async () => {
    const { service, repo } = createMockService();
    await service.createTicket('u_traveler', {
      tourId: 't1',
      bookingId: 'b1',
      category: 'ITINERARY',
      subCategory: 'ITINERARY_SKIPPED_ATTRACTION',
      subject: 'Bỏ sót điểm tham quan',
      description: 'Mô tả chi tiết sự việc phát sinh',
      imagePublicIds: ['tripin/complaints/u_traveler/img1', 'tripin/complaints/u_traveler/img2'],
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          'https://res.cloudinary.com/test/image/upload/tripin/complaints/u_traveler/img1.jpg',
          'https://res.cloudinary.com/test/image/upload/tripin/complaints/u_traveler/img2.jpg',
        ],
      }),
    );
  });

  it('chặn ảnh không thuộc về tài khoản tạo phiếu', async () => {
    const { service } = createMockService();
    await expect(
      service.createTicket('u_traveler', {
        tourId: 't1',
        bookingId: 'b1',
        category: 'ITINERARY',
        subCategory: 'ITINERARY_SKIPPED_ATTRACTION',
        subject: 'Bỏ sót điểm tham quan',
        description: 'Mô tả chi tiết sự việc phát sinh',
        imagePublicIds: ['tripin/complaints/other_user/img1'],
      }),
    ).rejects.toThrow('Ảnh bằng chứng phải thuộc về tài khoản của bạn');
  });
});
