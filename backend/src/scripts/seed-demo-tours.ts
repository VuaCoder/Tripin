/**
 * Development-only discovery fixtures. This deliberately is not part of `seed`:
 * production bootstrap must never create public agencies or sellable tours by itself.
 *
 * Run: pnpm --filter backend seed:demo-tours
 */
import bcrypt from 'bcryptjs';
import { AGENCY_VERIFICATION_STATUS, ROLES, TOUR_STATUS, USER_STATUS } from '@travel-platform/constants';
import { connectDatabase, disconnectDatabase, prisma } from '../config/database';
import { categoriesRepository } from '../modules/categories';
import { DEFAULT_CATEGORIES } from './seed-logic';
import { slugify } from '../utils/slug';
import { toursRepository } from '../modules/tours/tours.repository';
import { usersRepository } from '../modules/users';
import { syncDemoTourReviews } from './demo-tour-reviews';

const AGENCIES = [
  { email: 'demo.coastal@tripri.local', name: 'Coastal Journeys', avatarUrl: 'https://ui-avatars.com/api/?name=Coastal+Journeys&background=087e8b&color=ffffff', companyName: 'Coastal Journeys Vietnam' },
  { email: 'demo.heritage@tripri.local', name: 'Heritage Routes', avatarUrl: 'https://ui-avatars.com/api/?name=Heritage+Routes&background=0b5963&color=ffffff', companyName: 'Heritage Routes Vietnam' },
  { email: 'demo.wild@tripri.local', name: 'Wild North Adventures', avatarUrl: 'https://ui-avatars.com/api/?name=Wild+North&background=b84a2f&color=ffffff', companyName: 'Wild North Adventures' },
] as const;

const DEMO_TOURS = [
  { title: 'Hạ Long – Hang Sửng Sốt – Đảo Ti Tốp 3N2Đ', destination: 'Quảng Ninh', durationDays: 3, basePrice: 3_490_000, category: 'beach-islands', agency: 0, image: 'https://images.unsplash.com/photo-1675111066042-9baa4c343157?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Sa Pa – Fansipan – Bản Cát Cát 3N2Đ', destination: 'Lào Cai', durationDays: 3, basePrice: 2_890_000, category: 'mountains-trekking', agency: 2, image: 'https://images.unsplash.com/photo-1666160416071-f760a7af9ea6?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Đà Nẵng – Bà Nà Hills – Hội An – Sơn Trà 4N3Đ', destination: 'Đà Nẵng', durationDays: 4, basePrice: 3_290_000, category: 'city-culture', agency: 1, image: 'https://images.unsplash.com/photo-1560113855-2ea616c915ee?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Sài Gòn – Ẩm Thực Đường Phố Buổi Tối', destination: 'TP. Hồ Chí Minh', durationDays: 1, basePrice: 890_000, category: 'food-cuisine', agency: 1, image: 'https://images.unsplash.com/photo-1778057522012-0071acdce1dc?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Phong Nha – Động Phong Nha – Sông Son 3N2Đ', destination: 'Quảng Bình', durationDays: 3, basePrice: 3_790_000, category: 'adventure', agency: 2, image: 'https://images.unsplash.com/photo-1554285859-6ac081ea54b9?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'An Giang – Rừng Tràm Trà Sư – Châu Đốc 2N1Đ', destination: 'An Giang', durationDays: 2, basePrice: 1_790_000, category: 'eco-nature', agency: 0, image: 'https://images.unsplash.com/photo-1580630873708-e0475b1856c4?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Nha Trang – Biển Đảo – Tháp Bà Ponagar 3N2Đ', destination: 'Khánh Hòa', durationDays: 3, basePrice: 2_690_000, category: 'beach-islands', agency: 0, image: 'https://images.unsplash.com/photo-1689326232193-d55f0b7965eb?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Tà Năng – Phan Dũng: Trekking 2N1Đ', destination: 'Bình Thuận', durationDays: 2, basePrice: 2_190_000, category: 'mountains-trekking', agency: 2, image: 'https://images.unsplash.com/photo-1678099006439-dba9e4d3f9f5?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Huế – Đại Nội – Sông Hương – Lăng Tẩm 2N1Đ', destination: 'Thừa Thiên Huế', durationDays: 2, basePrice: 1_990_000, category: 'city-culture', agency: 1, image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Hà Nội – Hồ Hoàn Kiếm – Phố Cổ – Ẩm Thực 2N1Đ', destination: 'Hà Nội', durationDays: 2, basePrice: 1_690_000, category: 'food-cuisine', agency: 1, image: 'https://images.unsplash.com/photo-1680962201936-e59a519c5bd1?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Hà Giang – Đồng Văn – Mã Pí Lèng – Sông Nho Quế 4N3Đ', destination: 'Hà Giang', durationDays: 4, basePrice: 4_290_000, category: 'adventure', agency: 2, image: 'https://images.unsplash.com/photo-1772013972260-498ee9903bf3?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Côn Đảo – Biển Đầm Trầu – Di Tích Lịch Sử 3N2Đ', destination: 'Bà Rịa – Vũng Tàu', durationDays: 3, basePrice: 4_690_000, category: 'eco-nature', agency: 0, image: 'https://images.unsplash.com/photo-1768040632264-d8ad69bd4536?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Mộc Châu – Đồi Chè – Cao Nguyên Tây Bắc 3N2Đ', destination: 'Sơn La', durationDays: 3, basePrice: 2_490_000, category: 'eco-nature', agency: 2, image: 'https://images.unsplash.com/photo-1764034372439-cf34b61ea0b9?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Phú Quốc – Bãi Sao – Nam Đảo – Hoàng Hôn 4N3Đ', destination: 'Kiên Giang', durationDays: 4, basePrice: 4_190_000, category: 'beach-islands', agency: 0, image: 'https://images.unsplash.com/photo-1693282814784-649be45a459b?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Cần Thơ – Chợ Nổi Cái Răng – Bến Ninh Kiều 2N1Đ', destination: 'Cần Thơ', durationDays: 2, basePrice: 1_590_000, category: 'food-cuisine', agency: 1, image: 'https://images.unsplash.com/photo-1705589244475-7ebbc0d3a842?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Ninh Bình – Tràng An – Cố Đô Hoa Lư 2N1Đ', destination: 'Ninh Bình', durationDays: 2, basePrice: 1_890_000, category: 'city-culture', agency: 1, image: 'https://images.unsplash.com/photo-1557750255-c76072a7aad1?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Đà Lạt – Hồ Xuân Hương – Rừng Thông 3N2Đ', destination: 'Lâm Đồng', durationDays: 3, basePrice: 2_290_000, category: 'eco-nature', agency: 2, image: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Hà Nội – Tràng An – Vịnh Hạ Long 4N3Đ', destination: 'Hà Nội – Ninh Bình – Quảng Ninh', durationDays: 4, basePrice: 5_190_000, category: 'city-culture', agency: 1, image: 'https://images.unsplash.com/photo-1675111066042-9baa4c343157?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Huế – Đà Nẵng – Bà Nà Hills – Hội An 4N3Đ', destination: 'Huế – Đà Nẵng – Quảng Nam', durationDays: 4, basePrice: 5_490_000, category: 'city-culture', agency: 1, image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Quy Nhơn – Kỳ Co – Eo Gió – Gành Đá Dĩa 4N3Đ', destination: 'Bình Định – Phú Yên', durationDays: 4, basePrice: 4_690_000, category: 'beach-islands', agency: 0, image: 'https://images.unsplash.com/photo-1668536495655-a0226ed8eb5d?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Nha Trang – Đà Lạt: Biển Và Cao Nguyên 4N3Đ', destination: 'Khánh Hòa – Lâm Đồng', durationDays: 4, basePrice: 4_390_000, category: 'eco-nature', agency: 2, image: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
  { title: 'Tây Ninh – Núi Bà Đen – Tòa Thánh 2N1Đ', destination: 'Tây Ninh', durationDays: 2, basePrice: 1_990_000, category: 'city-culture', agency: 1, image: 'https://images.unsplash.com/photo-1763625218888-c667751af28d?auto=format&fit=crop&w=1200&q=78', ratingAvg: 0, ratingCount: 0 },
] as const;

// Match the original fixture titles so an existing tour keeps its ID, bookings,
// departures and owner when its public name is brought up to date.
const LEGACY_TITLES = [
  'Vịnh Hạ Long – Du thuyền giữa kỳ quan',
  'Sapa săn mây và chinh phục Fansipan',
  'Đà Nẵng – Hội An, nhịp sống miền Trung',
  'Hành trình ẩm thực Sài Gòn về đêm',
  'Khám phá hang động Phong Nha',
  'Rừng tràm Trà Sư và miền Tây sông nước',
  'Nha Trang biển xanh và đảo Bình Ba',
  'Tà Năng – Phan Dũng trekking cuối tuần',
  'Huế di sản, lăng tẩm và sông Hương',
  'Hà Nội phố cổ và tinh hoa ẩm thực',
  'Cao nguyên đá Hà Giang mùa hoa',
  'Côn Đảo xanh – nghỉ dưỡng và thiên nhiên',
  'Mộc Châu mùa hoa và đồi chè xanh',
  'Phú Quốc hoàng hôn trên đảo ngọc',
  'Cần Thơ chợ nổi và vị ngọt miền Tây',
  'Tràng An – Hoa Lư, non nước Ninh Bình',
  'Đà Lạt rừng thông và sương sớm',
] as const;

// Original demo itineraries had one generic day even for multi-day tours. These are
// illustrative routes inspired by public destination guides, not copied operator packages.
const TOUR_PLANS = [
  ['Đến Hạ Long|Đón khách tại trung tâm Hạ Long|Lên du thuyền và ngắm vịnh', 'Hang Sửng Sốt và đảo Ti Tốp|Tham quan hang Sửng Sốt|Dừng chân tại đảo Ti Tốp theo lịch tàu', 'Trở về bờ|Ngắm bình minh trên vịnh|Kết thúc hành trình'],
  ['Đến Sa Pa|Nhận phòng|Dạo trung tâm thị trấn', 'Fansipan|Di chuyển đến ga cáp treo|Tham quan khu vực đỉnh Fansipan', 'Bản Cát Cát|Đi bộ theo tuyến tham quan|Tìm hiểu đời sống địa phương'],
  ['Đến Đà Nẵng|Nhận phòng|Dạo biển Mỹ Khê', 'Bà Nà và Cầu Vàng|Tham quan khu du lịch Bà Nà|Ngắm Cầu Vàng', 'Phố cổ Hội An|Dạo phố cổ|Khám phá ẩm thực miền Trung', 'Trở về Đà Nẵng|Tham quan Sơn Trà nếu thời tiết thuận lợi|Kết thúc hành trình'],
  ['Sài Gòn về đêm|Gặp hướng dẫn viên tại trung tâm|Khám phá các hàng quán địa phương|Dạo phố sau bữa tối'],
  ['Đến Phong Nha|Nhận phòng|Dạo ven sông Son', 'Động Phong Nha|Đi thuyền trên sông Son theo tuyến mở cửa|Tham quan động cùng hướng dẫn viên', 'Thiên nhiên Quảng Bình|Dạo làng ven sông|Kết thúc hành trình'],
  ['Rừng tràm Trà Sư|Di chuyển đến khu sinh thái|Đi xuồng ngắm rừng tràm', 'Châu Đốc|Dạo khu vực trung tâm|Thưởng thức ẩm thực An Giang'],
  ['Đến Nha Trang|Nhận phòng|Dạo bãi biển', 'Khám phá biển đảo|Đi tàu theo điều kiện biển|Tắm biển và nghỉ ngơi', 'Tháp Bà Ponagar|Tham quan quần thể tháp Chăm|Kết thúc hành trình'],
  ['Bắt đầu trekking|Phổ biến an toàn|Đi bộ qua đồi cỏ và điểm cắm trại', 'Hoàn thành cung đường|Ngắm bình minh|Đi bộ theo đoàn đến điểm đón'],
  ['Đại Nội Huế|Nhận phòng|Tham quan khu di tích Cố đô', 'Sông Hương và lăng tẩm|Dạo ven sông Hương|Tham quan điểm di sản theo lịch mở cửa'],
  ['Phố cổ Hà Nội|Dạo các tuyến phố trung tâm|Thử món ăn đặc trưng', 'Văn hóa thủ đô|Tham quan khu vực hồ Hoàn Kiếm|Khám phá thêm ẩm thực địa phương'],
  ['Đến Hà Giang|Gặp đoàn và phổ biến cung đường|Nghỉ đêm tại điểm dừng', 'Đồng Văn|Ngắm cảnh cao nguyên đá|Tìm hiểu văn hóa bản địa', 'Mã Pí Lèng và sông Nho Quế|Ngắm cảnh từ điểm dừng phù hợp|Nghỉ tại cao nguyên', 'Trở về|Dừng chân chụp ảnh|Kết thúc hành trình'],
  ['Đến Côn Đảo|Nhận phòng|Dạo bờ biển', 'Bãi Đầm Trầu|Tham quan bãi biển theo điều kiện thời tiết|Nghỉ ngơi bên biển', 'Di tích Côn Đảo|Tìm hiểu lịch sử địa phương tại điểm mở cửa|Kết thúc hành trình'],
  ['Đến Mộc Châu|Nhận phòng|Dạo cao nguyên', 'Đồi chè|Tham quan vùng trồng chè|Tìm hiểu sản vật địa phương', 'Cảnh sắc Tây Bắc|Thăm điểm ngắm cảnh theo mùa|Trở về'],
  ['Đến Phú Quốc|Nhận phòng|Dạo bãi biển', 'Nam đảo|Tham quan Bãi Sao|Ngắm biển và nghỉ ngơi', 'Trải nghiệm đảo ngọc|Khám phá điểm tham quan mở cửa|Ngắm hoàng hôn', 'Ngày cuối|Mua đặc sản địa phương|Kết thúc hành trình'],
  ['Cần Thơ sông nước|Đến bến Ninh Kiều|Dạo ven sông', 'Chợ nổi Cái Răng|Đi thuyền tham quan buổi sáng|Tìm hiểu ẩm thực miền Tây'],
  ['Tràng An|Đi thuyền theo tuyến mở cửa|Ngắm cảnh núi đá vôi', 'Hoa Lư|Tham quan khu di tích|Tìm hiểu lịch sử cố đô'],
  ['Đến Đà Lạt|Nhận phòng|Dạo quanh hồ Xuân Hương', 'Rừng thông|Đi bộ theo lối được phép|Ngắm cảnh cao nguyên', 'Sương sớm|Đón bình minh khi thời tiết thuận lợi|Kết thúc hành trình'],
  ['Hà Nội|Dạo phố cổ|Tham quan khu vực hồ Hoàn Kiếm', 'Ninh Bình|Đi thuyền theo tuyến Tràng An mở cửa|Tìm hiểu cảnh quan núi đá vôi', 'Vịnh Hạ Long|Lên tàu tham quan vịnh|Ngắm các đảo đá trên tuyến', 'Trở về Hà Nội|Dừng chân theo lịch trình|Kết thúc hành trình'],
  ['Cố đô Huế|Tham quan Đại Nội|Dạo ven sông Hương', 'Đà Nẵng|Di chuyển qua đèo Hải Vân hoặc hầm đường bộ|Dạo biển Mỹ Khê', 'Bà Nà Hills|Tham quan Cầu Vàng theo giờ mở cửa|Trở về Đà Nẵng', 'Hội An|Dạo phố cổ|Kết thúc hành trình'],
  ['Quy Nhơn|Nhận phòng|Dạo bờ biển thành phố', 'Kỳ Co và Eo Gió|Tham quan theo điều kiện biển|Ngắm cảnh bán đảo Phương Mai', 'Phú Yên|Tham quan Gành Đá Dĩa|Dạo khu vực Tuy Hòa', 'Trở về Quy Nhơn|Thưởng thức ẩm thực địa phương|Kết thúc hành trình'],
  ['Nha Trang|Nhận phòng|Dạo biển Trần Phú', 'Văn hóa Khánh Hòa|Tham quan Tháp Bà Ponagar|Khám phá ẩm thực địa phương', 'Đà Lạt|Di chuyển lên cao nguyên|Dạo quanh hồ Xuân Hương', 'Ngày cuối tại Đà Lạt|Tham quan điểm mở cửa|Kết thúc hành trình'],
  ['Núi Bà Đen|Đến Tây Ninh|Tham quan khu vực núi theo giờ mở cửa', 'Tòa Thánh Cao Đài|Tham quan khu vực được phép|Tìm hiểu kiến trúc và văn hóa địa phương'],
] as const;

if (DEMO_TOURS.length !== TOUR_PLANS.length) throw new Error('Demo tour plans are out of sync');

const TOUR_DESCRIPTIONS = [
  'Hành trình trên vịnh Hạ Long qua các đảo đá vôi, hang Sửng Sốt và đảo Ti Tốp.',
  'Khám phá thị trấn Sa Pa, lên Fansipan bằng cáp treo và đi bộ tại bản Cát Cát.',
  'Kết hợp biển Mỹ Khê, Bà Nà Hills, Cầu Vàng, phố cổ Hội An và bán đảo Sơn Trà.',
  'Dạo phố buổi tối tại TP. Hồ Chí Minh và khám phá các món ăn đường phố địa phương.',
  'Đi thuyền trên sông Son vào động Phong Nha và khám phá cảnh quan ven sông.',
  'Đi xuồng xuyên rừng tràm Trà Sư rồi tìm hiểu nhịp sống và ẩm thực Châu Đốc.',
  'Nghỉ bên biển Nha Trang, tham quan các đảo theo điều kiện biển và quần thể tháp Bà Ponagar.',
  'Đi bộ theo cung Tà Năng – Phan Dũng, cắm trại và ngắm cảnh cao nguyên.',
  'Tìm hiểu di sản Cố đô Huế qua Đại Nội, sông Hương và các điểm lăng tẩm.',
  'Dạo phố cổ, hồ Hoàn Kiếm và thưởng thức ẩm thực Hà Nội.',
  'Đi qua cao nguyên đá Đồng Văn, đèo Mã Pí Lèng và khu vực sông Nho Quế.',
  'Khám phá bãi Đầm Trầu và những di tích lịch sử trên Côn Đảo.',
  'Thăm vùng trồng chè và cảnh quan cao nguyên Mộc Châu.',
  'Dạo bãi Sao, khám phá khu vực Nam đảo Phú Quốc và ngắm hoàng hôn.',
  'Dạo bến Ninh Kiều và đi thuyền thăm chợ nổi Cái Răng vào buổi sáng.',
  'Đi thuyền ở Tràng An và tìm hiểu lịch sử Cố đô Hoa Lư.',
  'Dạo hồ Xuân Hương, đi bộ giữa rừng thông và ngắm cảnh cao nguyên Đà Lạt.',
  'Tuyến miền Bắc kết nối phố cổ Hà Nội, cảnh quan Tràng An và vịnh Hạ Long.',
  'Hành trình di sản miền Trung qua Đại Nội Huế, Đà Nẵng, Bà Nà Hills và phố cổ Hội An.',
  'Khám phá biển Kỳ Co, Eo Gió tại Quy Nhơn và thắng cảnh Gành Đá Dĩa ở Phú Yên.',
  'Kết hợp biển Nha Trang và khí hậu cao nguyên Đà Lạt trong một hành trình.',
  'Tham quan núi Bà Đen và tìm hiểu kiến trúc Tòa Thánh Cao Đài tại Tây Ninh.',
] as const;
if (DEMO_TOURS.length !== TOUR_DESCRIPTIONS.length) throw new Error('Demo tour descriptions are out of sync');

const imageUrl = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=78`;
// Each added image was checked against the photographer's location description.
const EXTRA_PHOTOS: readonly (readonly string[])[] = [
  [imageUrl('photo-1643029891412-92f9a81a8c16')], // Hạ Long
  [imageUrl('photo-1665905905591-fb66b0496481')], // Sa Pa
  [imageUrl('photo-1663684591502-93887202a863')], // Cầu Vàng, Đà Nẵng
  [],
  [imageUrl('photo-1719461208377-94ec5820e414')], // Động Phong Nha
  [],
  [],
  [],
  [imageUrl('photo-1758487892397-688ea7102b47')], // Đại Nội Huế
  [imageUrl('photo-1702118937156-d8f4d86076ac')], // Hồ Hoàn Kiếm
  [imageUrl('photo-1721543286969-b1cd07a92770')], // Sông Nho Quế
  [],
  [],
  [],
  [imageUrl('photo-1744760654110-c0befa6f57b3')], // Chợ nổi Cần Thơ
  [imageUrl('photo-1701878831277-915f037602c5')], // Tràng An
  [],
  [imageUrl('photo-1702118937156-d8f4d86076ac'), imageUrl('photo-1701878831277-915f037602c5'), imageUrl('photo-1643029891412-92f9a81a8c16')],
  [imageUrl('photo-1663684591502-93887202a863'), DEMO_TOURS[2]!.image],
  [],
  [DEMO_TOURS[6]!.image],
  [],
];
if (DEMO_TOURS.length !== EXTRA_PHOTOS.length) throw new Error('Demo tour photos are out of sync');

function tourContent(tour: (typeof DEMO_TOURS)[number], index: number) {
  const plan = TOUR_PLANS[index]!;
  if (plan.length !== tour.durationDays) throw new Error(`Invalid itinerary length for ${tour.title}`);
  const itinerary = plan.map((entry, day) => {
    const [title, ...activities] = entry.split('|');
    return { day: day + 1, title: title!, activities };
  });
  return {
    summary: itinerary.map((day) => day.title).join(' · '),
    description: TOUR_DESCRIPTIONS[index]!,
    images: [tour.image, ...EXTRA_PHOTOS[index]!],
    inclusions: ['Phương tiện di chuyển theo lịch trình', 'Hướng dẫn viên', 'Bảo hiểm du lịch'],
    exclusions: ['Chi phí cá nhân', 'Dịch vụ ngoài lịch trình'],
    itinerary,
    travelNotes: 'Lịch trình có thể điều chỉnh theo thời tiết và giờ mở cửa của điểm tham quan.',
  };
}

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
  const passwordHash = await bcrypt.hash('Tripri@123', 10);
  return Promise.all(AGENCIES.map(async (agency) => {
    const existing = await usersRepository.findByEmail(agency.email);
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, status: 'ACTIVE', role: 'AGENCY' },
      });
      return existing.id;
    }
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
    await prisma.user.update({
      where: { id: created.id },
      data: { passwordHash },
    });
    return created.id;
  }));
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo tours and mock reviews cannot be imported in production');
  await connectDatabase();
  try {
    const [categoryIds, agencyIds] = await Promise.all([ensureCategories(), ensureAgencies()]);
    let created = 0;
    let updated = 0;
    for (const [index, tour] of DEMO_TOURS.entries()) {
      const agencyId = agencyIds[tour.agency]!;
      const content = tourContent(tour, index);
      const current = await prisma.tour.findFirst({ where: { title: tour.title } });
      const exists = current ?? (index < LEGACY_TITLES.length
        ? await prisma.tour.findFirst({ where: { title: LEGACY_TITLES[index] } })
        : null);
      if (exists) {
        // Earlier demo imports may be owned by another development account. Refresh
        // only their untouched generic copy; never overwrite custom tour content.
        const legacySummary = `Hành trình ${tour.durationDays} ngày khám phá ${tour.destination} cùng đội ngũ địa phương giàu kinh nghiệm.`;
        const legacyContent = exists.summary === legacySummary &&
          Array.isArray(exists.itinerary) && exists.itinerary.length === 1 &&
          (exists.itinerary[0] as { title?: string })?.title === 'Khởi hành và khám phá';
        const priorFixtureContent = legacyContent || (exists.description?.startsWith('Hành trình tham khảo ') ?? false);
        const stockImage = exists.images[0]?.startsWith('https://images.unsplash.com/') ?? false;
        const needsImage = exists.images.length === 0 || (stockImage && exists.images[0] !== tour.image) ||
          (exists.images.length === 1 && exists.images[0] === tour.image && content.images.length > 1);
        const reviews = await prisma.review.aggregate({
          where: { tourId: exists.id, status: 'VISIBLE' },
          _avg: { rating: true },
          _count: { rating: true },
        });
        const ratingCount = reviews._count.rating;
        const ratingAvg = reviews._avg.rating ?? 0;
        const needsRating = exists.ratingCount !== ratingCount || exists.ratingAvg !== ratingAvg;
        if (priorFixtureContent) {
          await prisma.tour.update({ where: { id: exists.id }, data: { ...content, title: tour.title, ratingAvg, ratingCount } });
          updated += 1;
        } else if (exists.title !== tour.title || needsImage || needsRating) {
          await prisma.tour.update({ where: { id: exists.id }, data: {
            ...(exists.title !== tour.title ? { title: tour.title } : {}),
            ...(needsImage ? { images: content.images } : {}),
            ...(needsRating ? { ratingAvg, ratingCount } : {}),
          } });
          updated += 1;
        }
        if (agencyIds.includes(exists.agencyId)) {
          const upcoming = await prisma.tourDeparture.findFirst({
            where: { tourId: exists.id, date: { gt: new Date() }, isOpen: true },
          });
          if (!upcoming) {
            await prisma.tourDeparture.createMany({ data: [
              { tourId: exists.id, date: daysFromNow(7 + index * 2), capacity: 24, remaining: 24 },
              { tourId: exists.id, date: daysFromNow(38 + index * 2), capacity: 24, remaining: 24 },
            ] });
          }
        }
        continue;
      }
      const categoryId = categoryIds.get(tour.category);
      if (!categoryId) throw new Error(`Missing category ${tour.category}`);
      await toursRepository.create({
        agencyId,
        title: tour.title,
        ...content,
        destination: tour.destination,
        durationDays: tour.durationDays,
        basePrice: tour.basePrice,
        maxGroupSize: 24,
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
    // Repair known broken and mismatched fixture photos, including the public
    // payment-flow fixtures outside DEMO_TOURS.
    const knownBroken = new Map([
      ['photo-1504218727796-db522606b568', DEMO_TOURS[0]!.image],
      ['photo-1509030450996-dd1a3d4f05e7', DEMO_TOURS[9]!.image],
    ]);
    let repaired = 0;
    const otherTours = await prisma.tour.findMany({
      select: { id: true, destination: true, images: true },
    });
    for (const item of otherTours) {
      const images = item.images.map((image) => {
        const photoId = /images\.unsplash\.com\/(photo-[^?]+)/.exec(image)?.[1];
        if (item.destination === 'Hà Nội' && photoId === 'photo-1559592413-7cec4d0cae2b') return imageUrl('photo-1702118937156-d8f4d86076ac');
        if (item.destination === 'Đà Nẵng' && image.endsWith('1792604141012_d2ec00e7-2bfc-4e29-835d-cb645f75b7d1.png')) return imageUrl('photo-1663684591502-93887202a863');
        if (item.destination === 'TP. Hồ Chí Minh' && image.endsWith('1792518808227_acb82b31-7532-4ac1-98d1-9723e6ff70f5.png')) return DEMO_TOURS[3]!.image;
        if (item.destination === 'Phú Quốc' && photoId === 'photo-1507525428034-b723cf961d3e') return DEMO_TOURS[13]!.image;
        if (item.destination === 'Lâm Đồng' && photoId === 'photo-1544644181-1484b3fdfc62') return DEMO_TOURS[7]!.image;
        return (photoId && knownBroken.get(photoId)) || image;
      });
      if (images.length === 0 && item.destination === 'Đà Nẵng') images.push(DEMO_TOURS[2]!.image);
      if (images.length === item.images.length && images.every((image, index) => image === item.images[index])) continue;
      await prisma.tour.update({ where: { id: item.id }, data: { images } });
      repaired += 1;
    }
    const reviews = await syncDemoTourReviews(DEMO_TOURS.map((tour, index) => ({ title: tour.title, images: tourContent(tour, index).images })));
    console.log(`[seed:demo-tours] created ${created}; refreshed ${updated}; repaired ${repaired} other tour images; created ${reviews.created} mock reviews; replaced ${reviews.replaced} generic mock reviews`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error(`[seed:demo-tours] failed: ${(error as Error).message}`);
  process.exit(1);
});
