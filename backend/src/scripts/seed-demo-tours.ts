/**
 * Development-only discovery fixtures. This deliberately is not part of `seed`:
 * production bootstrap must never create public agencies or sellable tours by itself.
 *
 * Run: pnpm --filter backend seed:demo-tours
 */
import { AGENCY_VERIFICATION_STATUS, ROLES, TOUR_STATUS, USER_STATUS } from '@travel-platform/constants';
import { connectDatabase, disconnectDatabase, prisma } from '../config/database';
import { categoriesRepository } from '../modules/categories';
import { DEFAULT_CATEGORIES } from './seed-logic';
import { slugify } from '../utils/slug';
import { toursRepository } from '../modules/tours/tours.repository';
import { usersRepository } from '../modules/users';

const AGENCIES = [
  { email: 'demo.coastal@tripri.local', name: 'Coastal Journeys', avatarUrl: 'https://ui-avatars.com/api/?name=Coastal+Journeys&background=087e8b&color=ffffff', companyName: 'Coastal Journeys Vietnam' },
  { email: 'demo.heritage@tripri.local', name: 'Heritage Routes', avatarUrl: 'https://ui-avatars.com/api/?name=Heritage+Routes&background=0b5963&color=ffffff', companyName: 'Heritage Routes Vietnam' },
  { email: 'demo.wild@tripri.local', name: 'Wild North Adventures', avatarUrl: 'https://ui-avatars.com/api/?name=Wild+North&background=b84a2f&color=ffffff', companyName: 'Wild North Adventures' },
] as const;

const DEMO_TOURS = [
  { title: 'Vịnh Hạ Long – Du thuyền giữa kỳ quan', destination: 'Quảng Ninh', durationDays: 3, basePrice: 3_490_000, category: 'beach-islands', agency: 0, image: 'https://images.unsplash.com/photo-1504218727796-db522606b568?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.8, ratingCount: 124 },
  { title: 'Sapa săn mây và chinh phục Fansipan', destination: 'Lào Cai', durationDays: 3, basePrice: 2_890_000, category: 'mountains-trekking', agency: 2, image: 'https://images.unsplash.com/photo-1570366583862-f91883984fde?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.7, ratingCount: 86 },
  { title: 'Đà Nẵng – Hội An, nhịp sống miền Trung', destination: 'Đà Nẵng', durationDays: 4, basePrice: 3_290_000, category: 'city-culture', agency: 1, image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.9, ratingCount: 216 },
  { title: 'Hành trình ẩm thực Sài Gòn về đêm', destination: 'TP. Hồ Chí Minh', durationDays: 1, basePrice: 890_000, category: 'food-cuisine', agency: 1, image: 'https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.6, ratingCount: 58 },
  { title: 'Khám phá hang động Phong Nha', destination: 'Quảng Bình', durationDays: 3, basePrice: 3_790_000, category: 'adventure', agency: 2, image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.8, ratingCount: 91 },
  { title: 'Rừng tràm Trà Sư và miền Tây sông nước', destination: 'An Giang', durationDays: 2, basePrice: 1_790_000, category: 'eco-nature', agency: 0, image: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.5, ratingCount: 43 },
  { title: 'Nha Trang biển xanh và đảo Bình Ba', destination: 'Khánh Hòa', durationDays: 3, basePrice: 2_690_000, category: 'beach-islands', agency: 0, image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.7, ratingCount: 102 },
  { title: 'Tà Năng – Phan Dũng trekking cuối tuần', destination: 'Bình Thuận', durationDays: 2, basePrice: 2_190_000, category: 'mountains-trekking', agency: 2, image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.6, ratingCount: 67 },
  { title: 'Huế di sản, lăng tẩm và sông Hương', destination: 'Thừa Thiên Huế', durationDays: 2, basePrice: 1_990_000, category: 'city-culture', agency: 1, image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.8, ratingCount: 135 },
  { title: 'Hà Nội phố cổ và tinh hoa ẩm thực', destination: 'Hà Nội', durationDays: 2, basePrice: 1_690_000, category: 'food-cuisine', agency: 1, image: 'https://images.unsplash.com/photo-1509030450996-dd1a3d4f05e7?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.5, ratingCount: 74 },
  { title: 'Cao nguyên đá Hà Giang mùa hoa', destination: 'Hà Giang', durationDays: 4, basePrice: 4_290_000, category: 'adventure', agency: 2, image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.9, ratingCount: 153 },
  { title: 'Côn Đảo xanh – nghỉ dưỡng và thiên nhiên', destination: 'Bà Rịa – Vũng Tàu', durationDays: 3, basePrice: 4_690_000, category: 'eco-nature', agency: 0, image: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.8, ratingCount: 98 },
  { title: 'Mộc Châu mùa hoa và đồi chè xanh', destination: 'Sơn La', durationDays: 3, basePrice: 2_490_000, category: 'eco-nature', agency: 2, image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.7, ratingCount: 61 },
  { title: 'Phú Quốc hoàng hôn trên đảo ngọc', destination: 'Kiên Giang', durationDays: 4, basePrice: 4_190_000, category: 'beach-islands', agency: 0, image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.9, ratingCount: 188 },
  { title: 'Cần Thơ chợ nổi và vị ngọt miền Tây', destination: 'Cần Thơ', durationDays: 2, basePrice: 1_590_000, category: 'food-cuisine', agency: 1, image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80', ratingAvg: 4.6, ratingCount: 70 },
] as const;

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function ensureCategories(): Promise<Map<string, string>> {
  for (const category of DEFAULT_CATEGORIES) {
    const slug = slugify(category.name);
    if (!(await categoriesRepository.findBySlug(slug))) await categoriesRepository.create({ ...category, slug });
  }
  const entries = await Promise.all(DEFAULT_CATEGORIES.map(async (category) => {
    const record = await categoriesRepository.findBySlug(slugify(category.name));
    if (!record) throw new Error(`Missing demo category ${category.name}`);
    return [record.slug, record.id] as const;
  }));
  return new Map(entries);
}

async function ensureAgencies(): Promise<string[]> {
  return Promise.all(AGENCIES.map(async (agency) => {
    const existing = await usersRepository.findByEmail(agency.email);
    if (existing) return existing.id;
    const created = await usersRepository.create({
      email: agency.email,
      fullName: agency.name,
      avatarUrl: agency.avatarUrl,
      role: ROLES.AGENCY,
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: new Date(),
      agencyProfile: {
        companyName: agency.companyName,
        verificationStatus: AGENCY_VERIFICATION_STATUS.VERIFIED,
        verifiedAt: new Date(),
      },
    });
    return created.id;
  }));
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    const [categoryIds, agencyIds] = await Promise.all([ensureCategories(), ensureAgencies()]);
    let created = 0;
    for (const [index, tour] of DEMO_TOURS.entries()) {
      const exists = await prisma.tour.findFirst({ where: { title: tour.title } });
      if (exists) continue;
      const categoryId = categoryIds.get(tour.category);
      if (!categoryId) throw new Error(`Missing category ${tour.category}`);
      await toursRepository.create({
        agencyId: agencyIds[tour.agency]!,
        title: tour.title,
        summary: `Hành trình ${tour.durationDays} ngày khám phá ${tour.destination} cùng đội ngũ địa phương giàu kinh nghiệm.`,
        description: `Một chuyến đi được thiết kế để bạn khám phá những điểm đến đặc trưng tại ${tour.destination}, với lịch trình cân bằng giữa trải nghiệm và nghỉ ngơi.`,
        destination: tour.destination,
        durationDays: tour.durationDays,
        basePrice: tour.basePrice,
        maxGroupSize: 24,
        images: [tour.image],
        inclusions: ['Xe đưa đón theo lịch trình', 'Hướng dẫn viên địa phương', 'Bảo hiểm du lịch'],
        exclusions: ['Chi phí cá nhân', 'Bữa ăn ngoài chương trình'],
        itinerary: [{ day: 1, title: 'Khởi hành và khám phá', activities: ['Đón khách', 'Tham quan điểm nổi bật'] }],
        categoryIds: [categoryId],
        status: TOUR_STATUS.APPROVED,
        ratingAvg: tour.ratingAvg,
        ratingCount: tour.ratingCount,
        departures: [
          {
            date: daysFromNow(7 + index * 2),
            capacity: 24,
            remaining: 24 - (index % 7),
            ...(index % 3 === 0 ? { priceOverride: tour.basePrice + 200_000 } : {}),
            isOpen: true,
          },
          { date: daysFromNow(38 + index * 2), capacity: 24, remaining: 24, isOpen: true },
        ],
      });
      created += 1;
    }
    console.log(`[seed:demo-tours] created ${created} tours; existing demo records were left unchanged`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error(`[seed:demo-tours] failed: ${(error as Error).message}`);
  process.exit(1);
});
