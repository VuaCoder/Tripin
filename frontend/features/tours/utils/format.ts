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

/** Định dạng số tiền có dấu chấm phân cách hàng nghìn khi người dùng gõ vào ô input (VD: 50000 -> "50.000") */
export function formatCurrencyVndInput(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '' || val === 0) return '';
  const digits = typeof val === 'number' ? Math.round(val).toString() : val.toString().replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Tách lấy số nguyên từ chuỗi tiền tệ có dấu chấm/phẩy */
export function parseCurrencyVndInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
