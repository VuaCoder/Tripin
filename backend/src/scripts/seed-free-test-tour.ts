import { TOUR_STATUS } from '@travel-platform/constants';
import { connectDatabase, disconnectDatabase, prisma } from '../config/database';
import { toursRepository } from '../modules/tours/tours.repository';

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  await connectDatabase();
  try {
    // Find an existing active agency and category
    const agency = await prisma.user.findFirst({
      where: { role: 'AGENCY', status: 'ACTIVE' },
    });
    if (!agency) throw new Error('No active agency found in database');

    const category = await prisma.category.findFirst();
    if (!category) throw new Error('No category found in database');

    const title = '[TEST FLOW] Trải Nghiệm Khám Phá Bản Địa (Tour Thử Nghiệm 0đ)';

    // Remove old test tour if it exists to ensure clean state
    const existing = await prisma.tour.findFirst({ where: { title } });
    if (existing) {
      console.log(`Found existing test tour ${existing.id}, deleting to refresh...`);
      await prisma.tour.delete({ where: { id: existing.id } });
    }

    const created = await toursRepository.create({
      agencyId: agency.id,
      title,
      summary: 'Tour thử nghiệm quy trình Đặt tour -> Thanh toán -> Nhận vé điện tử E-ticket với chi phí 0đ.',
      description: 'Tour thử nghiệm toàn diện dành cho kiểm thử: Xem chi tiết tour -> Chọn ngày khởi hành -> Đặt chỗ -> Xác nhận 0đ -> Nhận vé điện tử (E-ticket) kèm mã QR xác thực.',
      destination: 'Hà Nội',
      durationDays: 1,
      basePrice: 0,
      maxGroupSize: 50,
      images: [
        'https://images.unsplash.com/photo-1509030450996-dd1a3d4f05e7?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80',
      ],
      inclusions: [
        'Trải nghiệm toàn bộ luồng hệ thống',
        'Vé điện tử E-ticket tức thì',
        'Mã QR định danh bảo mật duy nhất',
      ],
      exclusions: ['Không phát sinh chi phí'],
      itinerary: [
        {
          day: 1,
          title: 'Khám phá và nhận vé điện tử E-ticket',
          activities: ['Đặt chỗ 0đ thành công', 'Hệ thống tự động phát hành E-ticket', 'Quét mã QR kiểm tra thông tin'],
        },
      ],
      categoryIds: [category.id],
      status: TOUR_STATUS.APPROVED,
      ratingAvg: 5.0,
      ratingCount: 99,
      departures: [
        { date: daysFromNow(1), capacity: 50, remaining: 50, priceOverride: 0, isOpen: true },
        { date: daysFromNow(2), capacity: 50, remaining: 50, priceOverride: 0, isOpen: true },
        { date: daysFromNow(3), capacity: 50, remaining: 50, priceOverride: 0, isOpen: true },
        { date: daysFromNow(7), capacity: 50, remaining: 50, priceOverride: 0, isOpen: true },
        { date: daysFromNow(14), capacity: 50, remaining: 50, priceOverride: 0, isOpen: true },
        { date: daysFromNow(30), capacity: 50, remaining: 50, priceOverride: 0, isOpen: true },
      ],
    });

    console.log(`[seed-free-test-tour] Created 0 VND test tour successfully!`);
    console.log(`Tour ID: ${created.id}`);
    console.log(`Title: ${created.title}`);
    console.log(`Price: ${created.basePrice} VND`);
    console.log(`Departures: ${created.departures.length} dates available`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('[seed-free-test-tour] Error:', err);
  process.exit(1);
});
