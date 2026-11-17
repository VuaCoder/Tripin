/** Rebuild only Traveler01's sample support data. Read this UTF-8 file directly; do not pipe source via PowerShell. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { prisma, disconnectDatabase } from '../config/database';
import { env } from '../config/env';

async function main() {
  if (env.NODE_ENV !== 'development' || !process.argv.includes('--apply')) throw new Error('Requires development and --apply.');
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'traveler01@tripri.test' } });
  if (user.role !== 'TRAVELER' || user.fullName !== 'Traveler01') throw new Error('Unexpected test account.');
  const bookings = await prisma.booking.findMany({ where: { travelerId: user.id, bookingCode: { startsWith: 'TRV01-DEMO-' } } });
  const confirmed = bookings.find(b => b.bookingCode.endsWith('-CONFIRMED'))!;
  const completed = bookings.find(b => b.bookingCode.endsWith('-COMPLETED'))!;
  if (!confirmed || !completed) throw new Error('Missing demo bookings.');
  const owner = await prisma.agencyMember.findFirstOrThrow({ where: { agencyId: confirmed.agencyId, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } } });
  const guide = await prisma.user.findFirstOrThrow({ where: { role: 'TOUR_GUIDE', status: 'ACTIVE', staffStatus: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
  const oldReports = await prisma.report.findMany({ where: { reporterId: user.id } });
  const oldTickets = await prisma.complaintTicket.findMany({ where: { travelerId: user.id }, include: { messages: true, feedback: true } });
  const oldConversations = await prisma.conversation.findMany({ where: { travelerId: user.id }, include: { messages: true } });
  const oldNotifications = await prisma.notification.findMany({ where: { userId: user.id } });
  const vouchers = await prisma.userVoucher.findMany({ where: { userId: user.id }, include: { promotion: true } });
  const backupDir = path.resolve('../.test-artifacts/traveler01');
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(path.join(backupDir, `data-before-${Date.now()}.json`), JSON.stringify({ oldReports, oldTickets, oldConversations, oldNotifications, bookings, vouchers }, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2), { encoding: 'utf8', flag: 'wx' });
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);
  await prisma.$transaction(async tx => {
    // The user explicitly requested replacing old reports/complaints for this test account.
    await tx.report.deleteMany({ where: { reporterId: user.id } });
    await tx.complaintTicket.deleteMany({ where: { travelerId: user.id } });
    const staleIds = new Set([...oldReports, ...oldTickets].map(r => r.id));
    const staleNotifications = oldNotifications.filter(n => n.title.startsWith('[TEST Traveler01]') || Object.values((n.data ?? {}) as Record<string, string>).some(value => staleIds.has(value)));
    await tx.notification.deleteMany({ where: { userId: user.id, id: { in: staleNotifications.map(n => n.id) } } });
    // Only replace seeded chat messages, preserving any real test activity added by the user.
    const seededMessages = oldConversations.flatMap(c => c.messages.filter(m => m.text.startsWith('[TEST Traveler01]') || m.text.startsWith('[TIN NH') || m.text.startsWith('[Tin nhắn mẫu]')));
    await tx.message.deleteMany({ where: { id: { in: seededMessages.map(m => m.id) } } });

    // Repair the other previously piped fixture strings without modifying real catalog content.
    for (const booking of bookings) {
      const snapshot = Array.isArray(booking.passengerSnapshot) ? booking.passengerSnapshot : [];
      await tx.booking.update({ where: { id: booking.id }, data: {
        notes: '[TEST Traveler01] Dữ liệu mẫu để kiểm tra đặt chỗ; thanh toán được giả lập.',
        ...(booking.status === 'CANCELLED' ? { cancelNote: 'Hủy đơn mẫu theo yêu cầu của hành khách.' } : {}),
        passengerSnapshot: snapshot.map((p, index) => ({ ...(p as object),
          fullName: index === 0 ? 'Traveler01' : `Hành khách mẫu ${index + 1}`,
          pickupPoint: 'Tập trung theo hướng dẫn trong lịch trình tour',
          ...(index === 1 ? { specialNotes: 'Ăn chay, vui lòng hỗ trợ suất ăn phù hợp.' } : {}),
        })),
      } });
    }
    const voucherTitles: Record<string, string> = {
      'TRV01-100K': '[TEST Traveler01] Giảm 100.000đ',
      'TRV01-10PCT': '[TEST Traveler01] Giảm 10%, tối đa 300.000đ',
      'TRV01-USED50K': '[TEST Traveler01] Voucher đã sử dụng',
      'TRV01-EXPIRED': '[TEST Traveler01] Voucher đã hết hạn',
    };
    for (const voucher of vouchers) {
      const title = voucherTitles[voucher.promotion.code ?? ''];
      if (title) await tx.promotion.update({ where: { id: voucher.promotionId }, data: { title, description: 'Dữ liệu mẫu cho Traveler01 trong môi trường development.' } });
    }
    await tx.payment.updateMany({ where: { userId: user.id, provider: 'DEV_FIXTURE' }, data: { description: '[TEST Traveler01] Thanh toán giả lập cho đơn đặt tour mẫu' } });

    const complaintFixtures = [
      { code: 'CP-TRV01-001', booking: confirmed, status: 'OPEN' as const, category: 'ACCOMMODATION_DINING' as const, subCategory: 'DINING_POOR_QUALITY_OR_UNSAFE', priority: 'NORMAL' as const,
        subject: '[Mẫu] Cần xác nhận suất ăn chay cho hành khách',
        description: 'Tôi đã ghi chú một hành khách ăn chay nhưng chưa thấy xác nhận. Nhờ agency kiểm tra thực đơn và phản hồi trước ngày khởi hành.',
        response: null, solution: null },
      { code: 'CP-TRV01-002', booking: completed, status: 'IN_PROGRESS' as const, category: 'ITINERARY' as const, subCategory: 'ITINERARY_SKIPPED_ATTRACTION', priority: 'NORMAL' as const,
        subject: '[Mẫu] Thiếu một điểm tham quan trong lịch trình',
        description: 'Trong chuyến đi vừa qua, đoàn không ghé một điểm tham quan đã công bố. Tôi muốn được giải thích lý do và phương án hỗ trợ phù hợp.',
        response: 'Agency đã tiếp nhận phản ánh và đang đối chiếu lịch trình với hướng dẫn viên. Chúng tôi sẽ cập nhật kết quả trong phiếu này.', solution: null },
      { code: 'CP-TRV01-003', booking: completed, status: 'CLOSED' as const, category: 'TRANSPORT' as const, subCategory: 'TRANSPORT_LATE_OR_MISSED_PICKUP', priority: 'HIGH' as const,
        subject: '[Mẫu] Xe đón muộn so với giờ hẹn',
        description: 'Xe đón đến muộn khoảng 30 phút so với giờ thông báo. Đề nghị agency kiểm tra để tránh ảnh hưởng thời gian tham quan.',
        response: 'Agency xin ghi nhận việc xe đón chậm và đã làm việc với nhà xe để điều chỉnh quy trình thông báo cho hành khách.',
        solution: 'Đã giải thích nguyên nhân, thống nhất phương án xử lý và được hành khách xác nhận hoàn tất.' },
    ];
    const ticketIds: string[] = [];
    for (const [index, f] of complaintFixtures.entries()) {
      const createdAt = at(180 + index * 240);
      const ticket = await tx.complaintTicket.create({ data: {
        ticketCode: f.code, travelerId: user.id, agencyId: f.booking.agencyId, tourId: f.booking.tourId, bookingId: f.booking.id,
        category: f.category, subCategory: f.subCategory, subject: f.subject, description: f.description, status: f.status, priority: f.priority,
        createdAt, lastMessageAt: f.solution ? at(60 + index * 240) : f.response ? at(120 + index * 240) : createdAt,
        slaHours: 48, slaDeadlineAt: new Date(createdAt.getTime() + 48 * 3_600_000),
        firstResponseAt: f.response ? at(120 + index * 240) : null,
        solutionSummary: f.solution, resolvedAt: f.solution ? at(80 + index * 240) : null, closedAt: f.solution ? at(60 + index * 240) : null,
        messages: { create: [
          { senderId: user.id, senderRole: 'TRAVELER', text: f.description, createdAt },
          ...(f.response ? [{ senderId: owner.userId, senderRole: 'AGENCY', text: f.response, createdAt: at(120 + index * 240) }] : []),
          ...(f.solution ? [{ senderId: user.id, senderRole: 'TRAVELER', text: 'Tôi đã nhận được giải thích và đồng ý kết thúc khiếu nại. Cảm ơn agency đã hỗ trợ.', createdAt: at(60 + index * 240) }] : []),
        ] },
        ...(f.solution ? { feedback: { create: { travelerId: user.id, agencyId: f.booking.agencyId, rating: 4, speedScore: 4, attitudeScore: 5, satisfactionScore: 4, comment: 'Agency phản hồi rõ ràng, mong việc đưa đón được cải thiện trong các chuyến sau.' } } } : {}),
      } });
      ticketIds.push(ticket.id);
    }
    const report = await tx.report.create({ data: {
      reporterId: user.id, targetType: 'TOUR', targetId: confirmed.tourId, tourId: confirmed.tourId, agencyId: confirmed.agencyId,
      category: 'MISLEADING_INFO', description: '[Mẫu báo cáo sàn] Phần giới thiệu tour ghi hai thời lượng khác nhau. Đề nghị kiểm tra và thống nhất nội dung để tránh gây hiểu nhầm.',
      status: 'OPEN', openKey: `${user.id}:TOUR:${confirmed.tourId}`, createdAt: at(100),
    } });
    await tx.report.create({ data: {
      reporterId: user.id, targetType: 'TOUR', targetId: completed.tourId, tourId: completed.tourId, agencyId: completed.agencyId,
      category: 'INAPPROPRIATE_CONTENT', description: '[Mẫu báo cáo sàn] Mô tả tour có nội dung quảng cáo không liên quan đến chương trình du lịch. Nhờ bộ phận kiểm duyệt xem xét.',
      status: 'RESOLVED', openKey: null, createdAt: at(400), resolutionDecision: 'RESOLVED', resolutionById: admin.id,
      resolutionNote: 'Nội dung quảng cáo không phù hợp đã được rà soát và gỡ khỏi phần mô tả tour trong tình huống kiểm thử.', resolvedAt: at(300),
    } });

    const threads = [
      { agencyId: confirmed.agencyId, guideId: null, senderId: owner.userId, unread: 2, texts: [
        [user.id, '[TEST Traveler01] Chào agency, tôi muốn xác nhận điểm tập trung cho chuyến đi.'],
        [owner.userId, '[Tin nhắn mẫu] Bạn xem điểm tập trung trong chi tiết booking và đến trước giờ khởi hành 15 phút nhé.'],
        [user.id, '[TEST Traveler01] Tôi có một hành khách ăn chay, nhờ agency hỗ trợ giúp tôi.'],
        [owner.userId, '[Tin nhắn mẫu] Agency đã tiếp nhận yêu cầu ăn chay và sẽ xác nhận thực đơn trước chuyến đi.'],
        [owner.userId, '[Tin nhắn mẫu] Vé điện tử đã có trong tài khoản. Bạn nhớ chuẩn bị giấy tờ tùy thân khi tập trung nhé.'],
      ] },
      { agencyId: null, guideId: guide.id, senderId: guide.id, unread: 0, texts: [
        [user.id, '[TEST Traveler01] Chào anh/chị, tôi nên chuẩn bị hành lý thế nào cho tour vài ngày?'],
        [guide.id, '[Tin nhắn mẫu] Bạn nên mang giày dễ đi, áo khoác nhẹ, thuốc cá nhân và sạc dự phòng. Nhớ kiểm tra thời tiết trước chuyến đi nhé.'],
        [user.id, '[TEST Traveler01] Cảm ơn anh/chị, tôi sẽ chuẩn bị theo gợi ý.'],
        [guide.id, '[Tin nhắn mẫu] Rất vui được hỗ trợ. Nếu cần tư vấn thêm, bạn cứ nhắn tại đây nhé.'],
      ] },
    ];
    const conversationIds: string[] = [];
    for (const t of threads) {
      let c = await tx.conversation.findFirst({ where: { travelerId: user.id, agencyId: t.agencyId, guideId: t.guideId } });
      c ??= await tx.conversation.create({ data: { travelerId: user.id, agencyId: t.agencyId, guideId: t.guideId, ...(t.agencyId ? { tourId: confirmed.tourId } : {}) } });
      conversationIds.push(c.id);
      for (const [index, pair] of t.texts.entries()) {
        const [senderId, text] = pair;
        const unread = senderId !== user.id && t.unread > 0 && index >= t.texts.length - t.unread;
        await tx.message.create({ data: { conversationId: c.id, senderId: senderId!, text: text!, createdAt: at(30 - index), readAt: unread ? null : at(29 - index) } });
      }
      const last = await tx.message.findFirstOrThrow({ where: { conversationId: c.id }, orderBy: { createdAt: 'desc' } });
      const unreadTraveler = await tx.message.count({ where: { conversationId: c.id, senderId: { not: user.id }, readAt: null } });
      const unreadGuide = await tx.message.count({ where: { conversationId: c.id, senderId: user.id, readAt: null } });
      await tx.conversation.update({ where: { id: c.id }, data: { lastMessageText: last.text.slice(0, 200), lastMessageSenderId: last.senderId, lastMessageSentAt: last.createdAt, lastActivityAt: last.createdAt, unreadTraveler, unreadGuide, lastReadTravelerAt: at(t.unread ? 28 : 20), lastReadGuideAt: at(20) } });
    }
    const ticket = await tx.eTicket.findUniqueOrThrow({ where: { bookingId: confirmed.id } });
    const voucher = vouchers.find(v => v.promotion.code === 'TRV01-100K')!;
    const notices = [
      { type: 'CHAT_MESSAGE' as const, title: 'Agency có tin nhắn mới', body: 'Agency đã phản hồi về suất ăn và vé điện tử.', data: { conversationId: conversationIds[0]! } },
      { type: 'COMPLAINT_RECEIVED' as const, title: 'Đã tiếp nhận khiếu nại dịch vụ tour', body: 'Phiếu CP-TRV01-001 đã được ghi nhận. Bạn có thể theo dõi và trao đổi với agency.', data: { ticketId: ticketIds[0]!, ticketCode: 'CP-TRV01-001' } },
      { type: 'COMPLAINT_MESSAGE' as const, title: 'Agency đã phản hồi khiếu nại', body: 'Agency đang đối chiếu lịch trình với hướng dẫn viên cho phiếu CP-TRV01-002.', data: { ticketId: ticketIds[1]!, ticketCode: 'CP-TRV01-002' } },
      { type: 'ETICKET_ISSUED' as const, title: 'Vé điện tử đã sẵn sàng', body: `Vé cho chuyến ${confirmed.tourTitle} đã có trong tài khoản.`, data: { bookingId: confirmed.id, eTicketId: ticket.id } },
      { type: 'VOUCHER_COLLECTED' as const, title: 'Đã lưu voucher giảm 100.000đ', body: 'Mã TRV01-100K áp dụng cho đơn từ 500.000đ. Xem điều kiện trong ví voucher.', data: { voucherId: voucher.id, promotionId: voucher.promotionId } },
      { type: 'COMPLAINT_RESOLVED' as const, title: 'Khiếu nại đã hoàn tất', body: 'Phiếu CP-TRV01-003 đã đóng sau khi hành khách xác nhận phương án xử lý.', data: { ticketId: ticketIds[2]!, ticketCode: 'CP-TRV01-003' } },
      { type: 'REPORT_UPDATED' as const, title: 'Đã ghi nhận báo cáo vi phạm sàn', body: 'Báo cáo về thông tin thời lượng tour đã được tiếp nhận để kiểm duyệt.', data: { reportId: report.id } },
      { type: 'CHAT_MESSAGE' as const, title: 'Hướng dẫn viên đã trả lời', body: 'Hướng dẫn viên đã gửi gợi ý chuẩn bị hành lý trước chuyến đi.', data: { conversationId: conversationIds[1]! } },
    ];
    for (const [index, n] of notices.entries()) {
      await tx.notification.create({ data: { userId: user.id, ...n, title: `[TEST Traveler01] ${n.title}`, data: n.data, createdAt: at(15 + index), readAt: index >= 5 ? at(5) : null } });
    }
  }, { timeout: 60_000 });
  console.log(JSON.stringify({ repaired: user.email, serviceComplaints: 3, platformReports: 2, notifications: 8, sampleChatMessages: 9 }));
}

void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(disconnectDatabase);
