export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

export function formatDuration(days: number): string {
  if (days <= 1) return '1 ngày';
  return `${days} ngày ${days - 1} đêm`;
}

export function formatDepartureDate(date?: string): string {
  if (!date) return 'Chưa có lịch khởi hành';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

export const CATEGORY_NAME_MAP: Record<string, string> = {
  'beach & islands': 'Biển đảo & Nghỉ dưỡng',
  'mountains & trekking': 'Núi rừng & Trekking',
  'city & culture': 'Văn hóa & Phố thị',
  'food & cuisine': 'Ẩm thực & Đặc sản',
  'adventure': 'Phiêu lưu & Mạo hiểm',
  'eco & nature': 'Sinh thái & Thiên nhiên',
  'resort & wellness': 'Nghỉ dưỡng & Sức khỏe (Wellness)',
  'cruises & waterways': 'Du thuyền & Sông nước',
  'spiritual & pilgrimage': 'Tâm linh & Hành hương',
  'family friendly': 'Gia đình & Trẻ nhỏ',
  'day tour': 'Tour trong ngày',
  'photography & cloud hunting': 'Săn mây & Nhiếp ảnh',
  'camping & glamping': 'Cắm trại & Glamping',
  'festivals & events': 'Lễ hội & Sự kiện',
  'craft & agritourism': 'Làng nghề & Nông nghiệp',
  'luxury & private': 'Tour cao cấp & Riêng tư',
  'mice & corporate': 'MICE & Teambuilding',
  'honeymoon & romantic': 'Tuần trăng mật & Cặp đôi',
  'motorbike & road trip': 'Phượt xe máy & Đường dài',
};

/** Chuyển đổi tên danh mục tour từ tiếng Anh (seed database) sang tiếng Việt tự nhiên */
export function formatCategoryName(name?: string | null): string {
  if (!name) return '';
  const key = name.trim().toLowerCase();
  return CATEGORY_NAME_MAP[key] ?? name;
}

export { formatCurrencyVndInput, parseCurrencyVndInput } from '@/lib/travel-format';
