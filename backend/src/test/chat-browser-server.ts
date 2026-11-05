/** Disposable real backend + PostgreSQL for manual/Playwright chat acceptance.
 * Run with CLIENT_URL=http://localhost:3002; never uses the application's DB. */
import http from 'node:http';
import bcrypt from 'bcryptjs';
import setup from './global-setup';
import { TEMPLATE_DB } from './constants';
import { connectDatabase, disconnectDatabase, prisma } from '../config/database';
import { createApp } from '../app';
import { attachChatGateway } from '../modules/chat';
import { bookingsService } from '../modules/bookings';
import { aiService } from '../modules/ai';
import type { AiProvider } from '../modules/ai/providers';

async function main() {
  let adminUrl = '';
  const cleanup = await setup({ provide: (_key: string, value: string) => { adminUrl = value; } } as Parameters<typeof setup>[0]);
  await connectDatabase(adminUrl.replace(/\/postgres$/, `/${TEMPLATE_DB}`));
  const passwordHash = await bcrypt.hash('ChatSmoke2026!', 10);
  const users = await Promise.all((['TRAVELER', 'TOUR_GUIDE', 'TRAVELER', 'AGENCY'] as const).map((role, index) => prisma.user.create({ data: {
    email: ['traveler@chat.test', 'guide@chat.test', 'outsider@chat.test', 'agency@chat.test'][index]!,
    fullName: ['Traveler Kiểm Thử', 'Hướng Dẫn Viên Kiểm Thử', 'Traveler Ngoài Hội Thoại', 'Đại Lý Kiểm Thử'][index]!,
    passwordHash, role, status: 'ACTIVE', emailVerifiedAt: new Date(),
    ...(role === 'AGENCY' ? { agencyProfile: { create: { companyName: 'Chat Test Agency', verificationStatus: 'VERIFIED' } } } : {}),
  } })));
  if (process.env.CHAT_SMOKE_AI === '1') {
    // Local acceptance only: never call a paid model or seed the application's DB.
    (aiService as unknown as { provider: AiProvider }).provider = {
      name: 'browser-fixture', enabled: true,
      generate: async () => ({ text: 'Bạn có thể ghé Hội An và dạo phố cổ vào buổi chiều.' }),
    };
    for (let index = 0; index < 22; index++) {
      const date = new Date(); date.setDate(date.getDate() - index); date.setMilliseconds(0);
      await prisma.aiConversation.create({ data: {
        userId: users[0]!.id, title: index ? `Lịch trình ngày ${index}` : 'Kế hoạch Hội An', messageCount: 2, updatedAt: date,
        messages: { create: [
          { role: 'user', content: 'Tôi muốn đi Hội An', createdAt: new Date(date.getTime() - 1) },
          { role: 'assistant', content: index ? `Gợi ý cho ngày ${index}` : '**Hội An** có phố cổ và nhiều món ngon.', createdAt: date, readAt: index ? date : null },
        ] },
      } });
    }
  }
  const category = await prisma.category.create({ data: { name: 'Khám phá văn hóa', slug: 'test-cultural-tour' } });
  const tour = await prisma.tour.create({ data: {
    categories: { connect: { id: category.id } },
    agencyId: users[3]!.id, title: 'Ninh Bình – Tràng An, Tam Cốc & Cố đô Hoa Lư', destination: 'Ninh Bình', durationDays: 3, basePrice: 1500000, status: 'APPROVED',
    summary: 'Xuôi thuyền giữa núi đá vôi Tràng An, đạp xe bên những cánh đồng Tam Cốc và khám phá dấu ấn cố đô Hoa Lư. Một hành trình chậm rãi để tận hưởng vẻ đẹp thiên nhiên và văn hóa Ninh Bình.',
    description: 'Hành trình khám phá Ninh Bình trong 3 ngày, kết hợp tham quan cảnh quan thiên nhiên và tìm hiểu văn hóa địa phương.',
    images: ['http://localhost:3002/images/destination-ninh-binh.png', 'http://localhost:3002/images/hero-vietnam.png', 'http://localhost:3002/images/story-local-guide.png'],
    inclusions: ['Xe di chuyển theo lịch trình', 'Hai đêm lưu trú theo chương trình', 'Các bữa ăn và vé tham quan được ghi trong lịch trình'],
    exclusions: ['Chi phí cá nhân và các hoạt động ngoài chương trình', 'Đồ uống gọi thêm', 'Các dịch vụ không được ghi trong mục bao gồm'],
    agePricing: { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 },
    childPricingPolicy: 'Trẻ từ 2 đến dưới 12 tuổi áp dụng 50% giá người lớn. Em bé dưới 2 tuổi miễn phí giá tour. Quyền lợi và việc dùng chung giường được xác nhận trước khi đặt.',
    travelNotes: 'Có mặt tại điểm hẹn trước 30 phút. Mang giày đi bộ, mũ và trang phục phù hợp khi tham quan di tích. Lịch trình có thể điều chỉnh theo thời tiết sau khi thông báo cho đoàn.',
    cancellationPolicy: 'Liên hệ đơn vị tổ chức để xác nhận điều kiện đổi lịch và phí hủy trước khi đặt. Yêu cầu hủy được thực hiện qua trang quản lý chuyến đi.',
    requiredDocuments: 'Mang theo giấy tờ tùy thân còn hiệu lực của từng hành khách. Giấy tờ của trẻ em và khách quốc tế cần được xác nhận với đơn vị tổ chức trước chuyến đi.',
    itinerary: [
      { day: 1, title: 'Hà Nội – Cố đô Hoa Lư – Tam Cốc', description: 'Buổi sáng, đoàn di chuyển đến Ninh Bình và tham quan Cố đô Hoa Lư. Buổi chiều dành cho hành trình khám phá Tam Cốc cùng hướng dẫn viên.', activities: ['Đón khách tại điểm hẹn và khởi hành đi Ninh Bình', 'Tìm hiểu lịch sử các triều đại tại Cố đô Hoa Lư', 'Tham quan Tam Cốc và nhận phòng nghỉ ngơi'] },
      { day: 2, title: 'Tràng An – Đạp xe khám phá làng quê', description: 'Khám phá cảnh quan Tràng An bằng thuyền, đi qua những dãy núi đá vôi và hang động. Buổi chiều tận hưởng nhịp sống làng quê bằng xe đạp.', activities: ['Đi thuyền tham quan quần thể danh thắng Tràng An', 'Dùng bữa trưa với món ăn địa phương theo chương trình', 'Đạp xe qua làng quê và ngắm cảnh đồng lúa'] },
      { day: 3, title: 'Ninh Bình – Hà Nội', description: 'Tự do nghỉ ngơi và khám phá khu vực lưu trú. Sau bữa trưa, đoàn làm thủ tục trả phòng và trở về Hà Nội.', activities: ['Ăn sáng và tự do tham quan', 'Trả phòng, dùng bữa trưa', 'Di chuyển về Hà Nội, kết thúc hành trình'] },
    ],
    departures: { create: [30, 37, 44, 51].map((days, index) => ({ date: new Date(Date.now() + days * 86400000), capacity: 30, remaining: 30, priceOverride: index % 2 ? 1800000 : 1500000 })) },
    guideAssignment: { create: { guideId: users[1]!.id, feePerBooking: 100000, status: 'ACCEPTED' } },
  } });
  if (process.env.REVIEW_PHOTO_FIXTURE === 'true') {
    const departure = await prisma.tourDeparture.findFirstOrThrow({ where: { tourId: tour.id } });
    for (const user of [users[0]!, users[2]!]) {
      const booking = await bookingsService.createBooking(user.id, { tourId: tour.id, departureId: departure.id, participants: 1, contact: { fullName: user.fullName, phone: '0901234567' } });
      await prisma.booking.update({ where: { id: booking.id }, data: { status: 'COMPLETED', isPaid: true, completedAt: new Date() } });
      if (user.id === users[2]!.id) await prisma.review.create({ data: {
        bookingId: booking.id, tourId: tour.id, tourTitle: tour.title, agencyId: users[3]!.id, travelerId: user.id, rating: 5,
        comment: 'Khung cảnh Tràng An rất đẹp, lịch trình vừa sức và hướng dẫn viên nhiệt tình. Một chuyến đi đáng nhớ!',
        images: tour.images,
      } });
    }
    await prisma.tour.update({ where: { id: tour.id }, data: { ratingAvg: 5, ratingCount: 1 } });
  }
  const server = http.createServer(createApp());
  const io = attachChatGateway(server);
  server.listen(3003, '127.0.0.1', () => console.log(JSON.stringify({ ready: true, api: 'http://localhost:3003/api/v1', tourId: tour.id })));
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await new Promise<void>(resolve => io.close(() => resolve()));
    await disconnectDatabase(); await cleanup(); process.exit(0);
  };
  process.once('SIGINT', () => void stop()); process.once('SIGTERM', () => void stop());
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
