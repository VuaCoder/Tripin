export interface ProvinceData {
  name: string;
  region: 'Miền Bắc' | 'Miền Trung' | 'Miền Nam' | 'Tây Nguyên' | 'Khác';
  spots: string[];
  isOther?: boolean;
}

export function normalizeSearchText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

export const VIETNAM_PROVINCES: ProvinceData[] = [
  // Miền Bắc
  { name: 'Hà Nội', region: 'Miền Bắc', spots: ['Phố Cổ', 'Hồ Hoàn Kiếm', 'Hồ Tây', 'Văn Miếu', 'Ba Vì', 'Đường Lâm'] },
  { name: 'Hải Phòng', region: 'Miền Bắc', spots: ['Đảo Cát Bà', 'Vịnh Lan Hạ', 'Đồ Sơn', 'Bạch Long Vĩ'] },
  { name: 'Quảng Ninh', region: 'Miền Bắc', spots: ['Vịnh Hạ Long', 'Đảo Cô Tô', 'Vân Đồn', 'Yên Tử', 'Móng Cái', 'Bình Liêu'] },
  { name: 'Lào Cai', region: 'Miền Bắc', spots: ['Sa Pa', 'Đỉnh Fansipan', 'Bản Cát Cát', 'Bắc Hà', 'Y Tý'] },
  { name: 'Hà Giang', region: 'Miền Bắc', spots: ['Đồng Văn', 'Đèo Mã Pí Lèng', 'Mèo Vạc', 'Cột cờ Lũng Cú', 'Hoàng Su Phì'] },
  { name: 'Ninh Bình', region: 'Miền Bắc', spots: ['Tràng An', 'Tam Cốc - Bích Động', 'Chùa Bái Đính', 'Hang Múa', 'Cố đô Hoa Lư'] },
  { name: 'Cao Bằng', region: 'Miền Bắc', spots: ['Thác Bản Giốc', 'Khu di tích Pác Bó', 'Động Ngườm Ngao', 'Hồ Thang Hen'] },
  { name: 'Bắc Kạn', region: 'Miền Bắc', spots: ['Hồ Ba Bể', 'Động Puông', 'Thác Bản Vàng'] },
  { name: 'Lạng Sơn', region: 'Miền Bắc', spots: ['Mẫu Sơn', 'Ải Chi Lăng', 'Chùa Tam Thanh', 'Chợ Tân Thanh'] },
  { name: 'Tuyên Quang', region: 'Miền Bắc', spots: ['Hồ Na Hang', 'Tân Trào', 'Suối khoáng Mỹ Lâm'] },
  { name: 'Yên Bái', region: 'Miền Bắc', spots: ['Ruộng bậc thang Mù Cang Chải', 'Hồ Thác Bà', 'Suối Giàng', 'Trạm Tấu'] },
  { name: 'Thái Nguyên', region: 'Miền Bắc', spots: ['Hồ Núi Cốc', 'Đồi chè Tân Cương', 'ATK Định Hóa'] },
  { name: 'Phú Thọ', region: 'Miền Bắc', spots: ['Đền Hùng', 'Vườn quốc gia Xuân Sơn', 'Đồi chè Long Cốc'] },
  { name: 'Bắc Giang', region: 'Miền Bắc', spots: ['Tây Yên Tử', 'Khu du lịch Suối Mỡ', 'Đồng Cao'] },
  { name: 'Bắc Ninh', region: 'Miền Bắc', spots: ['Chùa Dâu', 'Chùa Phật Tích', 'Làng tranh Đông Hồ', 'Đền Đô'] },
  { name: 'Vĩnh Phúc', region: 'Miền Bắc', spots: ['Thị trấn Tam Đảo', 'Thiền viện Trúc Lâm Tây Thiên', 'Hồ Đại Lải'] },
  { name: 'Hải Dương', region: 'Miền Bắc', spots: ['Côn Sơn - Kiếp Bạc', 'Đảo Cò Chi Lăng Nam'] },
  { name: 'Hưng Yên', region: 'Miền Bắc', spots: ['Phố Hiến', 'Đền Chử Đồng Tử', 'Làng hương Cao Thôn'] },
  { name: 'Thái Bình', region: 'Miền Bắc', spots: ['Chùa Keo', 'Biển Đồng Châu', 'Cồn Vành'] },
  { name: 'Hà Nam', region: 'Miền Bắc', spots: ['Chùa Tam Chúc', 'Địa Tạng Phi Lai Tự', 'Bát Cảnh Sơn'] },
  { name: 'Nam Định', region: 'Miền Bắc', spots: ['Nhà thờ đổ Hải Lý', 'Chùa Phổ Minh', 'Vườn quốc gia Xuân Thủy'] },
  { name: 'Hòa Bình', region: 'Miền Bắc', spots: ['Bản Lác Mai Châu', 'Thung Nai', 'Hồ Hòa Bình', 'Suối khoáng Kim Bôi'] },
  { name: 'Sơn La', region: 'Miền Bắc', spots: ['Cao nguyên Mộc Châu', 'Săn mây Tà Xùa', 'Thác Dải Yếm'] },
  { name: 'Điện Biên', region: 'Miền Bắc', spots: ['Chiến trường Điện Biên Phủ', 'Cánh đồng Mường Thanh', 'Đèo Pha Đin'] },
  { name: 'Lai Châu', region: 'Miền Bắc', spots: ['Đèo Ô Quy Hồ', 'Bản Sin Suối Hồ', 'Cánh đồng Mường Than'] },

  // Miền Trung
  { name: 'Thanh Hóa', region: 'Miền Trung', spots: ['Biển Sầm Sơn', 'Khu bảo tồn Pù Luông', 'Thành nhà Hồ', 'Hải Tiến'] },
  { name: 'Nghệ An', region: 'Miền Trung', spots: ['Biển Cửa Lò', 'Khu di tích Kim Liên Quê Bác', 'Vườn quốc gia Pù Mát'] },
  { name: 'Hà Tĩnh', region: 'Miền Trung', spots: ['Biển Thiên Cầm', 'Ngã ba Đồng Lộc', 'Khu lưu niệm Nguyễn Du'] },
  { name: 'Quảng Bình', region: 'Miền Trung', spots: ['Vườn quốc gia Phong Nha - Kẻ Bàng', 'Hang Sơn Đoòng', 'Động Thiên Đường', 'Biển Nhật Lệ'] },
  { name: 'Quảng Trị', region: 'Miền Trung', spots: ['Thành cổ Quảng Trị', 'Địa đạo Vịnh Mốc', 'Cầu Hiền Lương', 'Khe Sanh'] },
  { name: 'Thừa Thiên Huế', region: 'Miền Trung', spots: ['Cố đô Huế', 'Đại Nội Huế', 'Chùa Thiên Mụ', 'Sông Hương', 'Vịnh Lăng Cô'] },
  { name: 'Đà Nẵng', region: 'Miền Trung', spots: ['Bà Nà Hills', 'Bán đảo Sơn Trà', 'Cầu Rồng', 'Ngũ Hành Sơn', 'Biển Mỹ Khê'] },
  { name: 'Quảng Nam', region: 'Miền Trung', spots: ['Phố cổ Hội An', 'Thánh địa Mỹ Sơn', 'Đảo Cù Lao Chàm', 'Rừng dừa Bảy Mẫu'] },
  { name: 'Quảng Ngãi', region: 'Miền Trung', spots: ['Đảo Lý Sơn', 'Bãi biển Mỹ Khê', 'Khu chứng tích Sơn Mỹ'] },
  { name: 'Bình Định', region: 'Miền Trung', spots: ['TP. Quy Nhơn', 'Bãi biển Kỳ Co', 'Eo Gió', 'Đảo Hòn Khô', 'Ghềnh Ráng'] },
  { name: 'Phú Yên', region: 'Miền Trung', spots: ['Gành Đá Đĩa', 'Bãi Xép hoa vàng trên cỏ xanh', 'Mũi Điện', 'Đầm Ô Loan'] },
  { name: 'Khánh Hòa', region: 'Miền Trung', spots: ['TP. Nha Trang', 'Vịnh Cam Ranh', 'Đảo Bình Ba', 'Điệp Sơn', 'Dốc Lết'] },
  { name: 'Ninh Thuận', region: 'Miền Trung', spots: ['Vịnh Vĩnh Hy', 'Đồi cát Nam Cương', 'Tháp Chàm Po Klong Garai', 'Hang Rái'] },
  { name: 'Bình Thuận', region: 'Miền Trung', spots: ['Mũi Né', 'Phan Thiết', 'Đảo Phú Quý', 'Bàu Trắng', 'Hải đăng Kê Gà'] },

  // Tây Nguyên
  { name: 'Kon Tum', region: 'Tây Nguyên', spots: ['Thị trấn Măng Đen', 'Nhà thờ Gỗ', 'Cột mốc ngã ba Đông Dương'] },
  { name: 'Gia Lai', region: 'Tây Nguyên', spots: ['TP. Pleiku', 'Biển Hồ T\'Nưng', 'Núi lửa Chư Đang Ya', 'Thác Phú Cường'] },
  { name: 'Đắk Lắk', region: 'Tây Nguyên', spots: ['TP. Buôn Ma Thuột', 'Hồ Lắk', 'Thác Dray Nur', 'Khu du lịch Buôn Đôn'] },
  { name: 'Đắk Nông', region: 'Tây Nguyên', spots: ['Hồ Tà Đùng (Vịnh Hạ Long Tây Nguyên)', 'Hệ thống hang động núi lửa Chư Blúk'] },
  { name: 'Lâm Đồng', region: 'Tây Nguyên', spots: ['TP. Đà Lạt', 'Đỉnh Langbiang', 'Hồ Tuyền Lâm', 'TP. Bảo Lộc', 'Thác Datanla'] },

  // Miền Nam
  { name: 'TP. Hồ Chí Minh', region: 'Miền Nam', spots: ['Sài Gòn', 'Chợ Bến Thành', 'Dinh Độc Lập', 'Phố đi bộ Nguyễn Huệ', 'Địa đạo Củ Chi'] },
  { name: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam', spots: ['TP. Vũng Tàu', 'Quần đảo Côn Đảo', 'Hồ Tràm', 'Long Hải', 'Suối khoáng Bình Châu'] },
  { name: 'Bình Dương', region: 'Miền Nam', spots: ['Khu du lịch Đại Nam', 'Chùa Tây Tạng', 'Làng gốm Lái Thiêu'] },
  { name: 'Bình Phước', region: 'Miền Nam', spots: ['Vườn quốc gia Bù Gia Mập', 'Trảng cỏ Bù Lạch', 'Núi Bà Rá'] },
  { name: 'Đồng Nai', region: 'Miền Nam', spots: ['Vườn quốc gia Cát Tiên', 'Khu du lịch Bửu Long', 'Thác Giang Điền'] },
  { name: 'Tây Ninh', region: 'Miền Nam', spots: ['Quần thể Núi Bà Đen', 'Tòa Thánh Tây Ninh', 'Hồ Dầu Tiếng'] },
  { name: 'Long An', region: 'Miền Nam', spots: ['Làng nổi Tân Lập', 'Cánh đồng bất tận', 'Khu sinh thái Cát Tường Phú Sinh'] },
  { name: 'Tiền Giang', region: 'Miền Nam', spots: ['Chợ nổi Cái Bè', 'Cù lao Thới Sơn', 'Trại rắn Đồng Tâm'] },
  { name: 'Bến Tre', region: 'Miền Nam', spots: ['Cồn Phụng', 'Cù lao Minh', 'Vườn cây ăn trái Chợ Lách'] },
  { name: 'Trà Vinh', region: 'Miền Nam', spots: ['Chùa Hang', 'Ao Bà Om', 'Biển Ba Động', 'Cù lao Long Trị'] },
  { name: 'Vĩnh Long', region: 'Miền Nam', spots: ['Cù lao An Bình', 'Cầu Mỹ Thuận', 'Chợ nổi Trà Ôn'] },
  { name: 'Đồng Tháp', region: 'Miền Nam', spots: ['Làng hoa Sa Đéc', 'Vườn quốc gia Tràm Chim', 'Khu di tích Xẻo Quýt'] },
  { name: 'An Giang', region: 'Miền Nam', spots: ['TP. Châu Đốc', 'Rừng tràm Trà Sư', 'Miếu Bà Chúa Xứ Núi Sam', 'Thất Sơn Bảy Núi'] },
  { name: 'Kiên Giang', region: 'Miền Nam', spots: ['Thành phố đảo Phú Quốc', 'Quần đảo Nam Du', 'Hà Tiên', 'Đảo Hòn Sơn', 'Rạch Giá'] },
  { name: 'Cần Thơ', region: 'Miền Nam', spots: ['Chợ nổi Cái Răng', 'Bến Ninh Kiều', 'Nhà cổ Bình Thủy', 'Vườn cò Bằng Lăng'] },
  { name: 'Hậu Giang', region: 'Miền Nam', spots: ['Chợ nổi Ngã Bảy', 'Khu bảo tồn thiên nhiên Lung Ngọc Hoàng'] },
  { name: 'Sóc Trăng', region: 'Miền Nam', spots: ['Chùa Dơi', 'Chùa Chén Kiểu', 'Chợ nổi Ngã Năm'] },
  { name: 'Bạc Liêu', region: 'Miền Nam', spots: ['Nhà Công tử Bạc Liêu', 'Cánh đồng điện gió Bạc Liêu', 'Nhà thờ Tắc Sậy'] },
  { name: 'Cà Mau', region: 'Miền Nam', spots: ['Mũi Cà Mau', 'Vườn quốc gia U Minh Hạ', 'Hòn Khoai'] },

  // Mục Khác
  { 
    name: 'Khác', 
    region: 'Khác', 
    spots: ['Quốc tế (Thái Lan, Singapore, Hàn Quốc...)', 'Tour liên tỉnh', 'Vùng điểm đến đặc biệt'],
    isOther: true
  },
];

export const POPULAR_PROVINCES: string[] = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Quảng Ninh',
  'Lào Cai',
  'Kiên Giang',
  'Khánh Hòa',
  'Lâm Đồng',
  'Ninh Bình',
  'Hội An',
  'Hà Giang',
  'Khác',
];

/**
 * Checks if a destination matches a province in the standard list
 */
export function findProvinceByName(name: string): ProvinceData | undefined {
  if (!name) return undefined;
  const normalized = normalizeSearchText(name);
  return VIETNAM_PROVINCES.find((p) => normalizeSearchText(p.name) === normalized);
}

/**
 * Searches and ranks Vietnam provinces based on query relevance.
 * Handles both accented ("đà", "hải") and unaccented ("da", "hai") queries.
 * Prioritizes:
 *  1. Province name exact or prefix match (e.g. "đà" -> Đà Nẵng at the very top)
 *  2. Province name word-start match (e.g. "minh" -> TP. Hồ Chí Minh)
 *  3. Famous landmark/spot exact or prefix match (e.g. "sa pa" -> Lào Cai, "hạ long" -> Quảng Ninh)
 */
export function searchVietnamProvinces(query: string): ProvinceData[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const rawQ = trimmed.toLowerCase();
  const normQ = normalizeSearchText(trimmed);
  const queryHasAccents = rawQ !== normQ;

  const scored: { province: ProvinceData; score: number }[] = [];

  for (const item of VIETNAM_PROVINCES) {
    if (item.isOther) continue;

    const rawName = item.name.toLowerCase();
    const normName = normalizeSearchText(item.name);

    let score = 0;

    // --- 1. PROVINCE NAME MATCHING ---
    if (rawName === rawQ) {
      score = 3000;
    } else if (rawName.startsWith(rawQ)) {
      score = 2500;
    } else {
      const rawWords = rawName.split(/\s+/);
      if (rawWords.some((w) => w.startsWith(rawQ))) {
        score = 1800;
      } else if (rawName.includes(rawQ)) {
        score = 1200;
      } else if (!queryHasAccents) {
        if (normName === normQ) {
          score = 2800;
        } else if (normName.startsWith(normQ)) {
          score = 2200;
        } else {
          const normWords = normName.split(/\s+/);
          if (normWords.some((w) => w.startsWith(normQ))) {
            score = 1500;
          } else if (normName.includes(normQ)) {
            score = 1000;
          }
        }
      }
    }

    // --- 2. TOURIST SPOTS MATCHING ---
    let bestSpotScore = 0;
    for (const spot of item.spots) {
      const rawSpot = spot.toLowerCase();
      const normSpot = normalizeSearchText(spot);

      if (rawSpot === rawQ) {
        bestSpotScore = Math.max(bestSpotScore, 2000);
      } else if (rawSpot.startsWith(rawQ)) {
        bestSpotScore = Math.max(bestSpotScore, 1600);
      } else {
        const rawSpotWords = rawSpot.split(/\s+/);
        if (rawSpotWords.some((w) => w.startsWith(rawQ))) {
          bestSpotScore = Math.max(bestSpotScore, 1100);
        } else if (!queryHasAccents) {
          if (normSpot === normQ) {
            bestSpotScore = Math.max(bestSpotScore, 1800);
          } else if (normSpot.startsWith(normQ)) {
            bestSpotScore = Math.max(bestSpotScore, 1400);
          } else {
            const normSpotWords = normSpot.split(/\s+/);
            if (normSpotWords.some((w) => w.startsWith(normQ))) {
              bestSpotScore = Math.max(bestSpotScore, 900);
            }
          }
        }
      }
    }

    const finalScore = Math.max(score, bestSpotScore);
    if (finalScore > 0) {
      scored.push({ province: item, score: finalScore });
    }
  }

  // Sort descending by score, tie-break by Vietnamese alphabetical order
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.province.name.localeCompare(b.province.name, 'vi');
  });

  return scored.map((s) => s.province);
}

