/**
 * Email templates for human-readable, professional notifications.
 * Tone: polite, clear, respectful and providing direct next steps / support information.
 */

export function formatBanEmail(input: {
  fullName?: string | null;
  email: string;
  reason: string;
}): string {
  const name = input.fullName?.trim() || 'Quý khách';
  return `Kính gửi ${name},

Ban quản trị TripRI xin thông báo: Tài khoản của Quý khách (${input.email}) đã bị tạm khóa quyền truy cập trên hệ thống TripRI.

Thông tin chi tiết:
- Trạng thái: Tạm khóa
- Lý do xử lý: ${input.reason}

Trong thời gian tài khoản bị khóa, Quý khách sẽ không thể đăng nhập hoặc thực hiện các thao tác đặt tour, thanh toán và gửi đánh giá trên nền tảng.

Nếu Quý khách cho rằng quyết định này có sự nhầm lẫn hoặc cần cung cấp thêm thông tin giải trình để khiếu nại, xin vui lòng phản hồi trực tiếp tới bộ phận Chăm sóc khách hàng của chúng tôi qua email: support@tripri.vn.

Trân trọng,
Đội ngũ Quản trị & Kiểm duyệt TripRI`;
}

export function formatUnbanEmail(input: {
  fullName?: string | null;
  email: string;
  reason: string;
}): string {
  const name = input.fullName?.trim() || 'Quý khách';
  return `Kính gửi ${name},

Ban quản trị TripRI xin thông báo: Tài khoản của Quý khách (${input.email}) đã được mở khóa và kích hoạt trở lại thành công.

Thông tin chi tiết:
- Trạng thái: Đang hoạt động
- Ghi chú từ ban quản trị: ${input.reason}

Hiện tại Quý khách đã có thể đăng nhập bình thường và tiếp tục sử dụng tất cả các dịch vụ du lịch trên nền tảng TripRI.

Cảm ơn Quý khách đã đồng hành cùng TripRI. Chúc Quý khách luôn có những chuyến đi ý nghĩa và trọn vẹn!

Trân trọng,
Đội ngũ Quản trị & Chăm sóc khách hàng TripRI`;
}

export function formatReviewModeratedTravelerEmail(input: {
  travelerName?: string | null;
  tourTitle: string;
  hidden: boolean;
  reason: string;
}): string {
  const name = input.travelerName?.trim() || 'Quý khách';
  if (input.hidden) {
    return `Kính gửi ${name},

Hệ thống Kiểm duyệt TripRI xin thông báo: Đánh giá của Quý khách dành cho tour "${input.tourTitle}" đã được chuyển sang trạng thái tạm ẩn và ngừng hiển thị công khai trên nền tảng.

Thông tin chi tiết:
- Tour áp dụng: ${input.tourTitle}
- Lý do kiểm duyệt: ${input.reason}

Quy định này nhằm đảm bảo tính khách quan, văn minh và tuân thủ Tiêu chuẩn cộng đồng của TripRI. Nếu Quý khách cần giải đáp thắc mắc hoặc gửi yêu cầu xem xét lại, xin vui lòng liên hệ với chúng tôi qua email: support@tripri.vn.

Trân trọng,
Đội ngũ Kiểm duyệt TripRI`;
  }

  return `Kính gửi ${name},

Hệ thống Kiểm duyệt TripRI xin thông báo: Đánh giá của Quý khách dành cho tour "${input.tourTitle}" đã được xem xét lại và khôi phục hiển thị công khai trên hệ thống.

Thông tin chi tiết:
- Tour áp dụng: ${input.tourTitle}
- Ghi chú từ ban kiểm duyệt: ${input.reason}

Cảm ơn Quý khách đã đóng góp những phản hồi quý giá giúp nâng cao chất lượng dịch vụ của cộng đồng TripRI.

Trân trọng,
Đội ngũ Kiểm duyệt TripRI`;
}

export function formatReviewModeratedAgencyEmail(input: {
  agencyName?: string | null;
  tourTitle: string;
  hidden: boolean;
  reason: string;
}): string {
  const name = input.agencyName?.trim() || 'Quý Đối tác';
  if (input.hidden) {
    return `Kính gửi ${name},

TripRI xin thông báo: Một đánh giá của khách hàng đối với tour "${input.tourTitle}" đã được đội ngũ kiểm duyệt xử lý tạm ẩn khỏi trang hiển thị công khai.

Thông tin chi tiết:
- Tour áp dụng: ${input.tourTitle}
- Lý do xử lý: ${input.reason}
- Điểm đánh giá trung bình của tour đã được tự động tính toán lại theo dữ liệu mới nhất.

Trân trọng,
Ban quản trị Đối tác TripRI`;
  }

  return `Kính gửi ${name},

TripRI xin thông báo: Đánh giá của khách hàng đối với tour "${input.tourTitle}" đã được xem xét lại và khôi phục trạng thái hiển thị công khai.

Thông tin chi tiết:
- Tour áp dụng: ${input.tourTitle}
- Lý do khôi phục: ${input.reason}
- Điểm đánh giá trung bình của tour đã được tự động cập nhật lại tương ứng.

Trân trọng,
Ban quản trị Đối tác TripRI`;
}

