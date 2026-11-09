import '../api/guide_check_in_api.dart';

/// Vietnamese messages for the stable backend codes. Unknown codes fall back to a safe generic text.
String guideErrorMessage(GuideApiException error) {
  switch (error.code) {
    case 'TICKET_WRONG_DEPARTURE':
      return 'Vé thuộc đợt khởi hành khác. Vui lòng kiểm tra lại chuyến đi.';
    case 'GUIDE_SCHEDULE_CONFLICT':
      return 'Bạn đã có lịch dẫn tour trong thời gian này. Vui lòng kiểm tra lại lịch.';
    case 'TRIP_NOT_ENDED':
      return 'Chuyến đi chưa kết thúc.';
    case 'DEPARTURE_REQUIRED':
      return 'Vui lòng chọn đợt khởi hành cần hoàn thành.';
    case 'TICKET_NOT_FOUND':
      return 'Mã vé không tồn tại hoặc không hợp lệ.';
    case 'TICKET_ALREADY_USED':
      return 'Vé này đã được điểm danh trước đó.';
    case 'TICKET_WRONG_TOUR':
      return 'Vé này thuộc tour khác, không thể điểm danh.';
    case 'TICKET_CANCELLED':
      return 'Vé này đã bị hủy.';
    case 'NOT_FOUND':
      return 'Tour không tồn tại hoặc bạn chưa được phân công.';
    case 'FORBIDDEN':
      return 'Bạn không có quyền điểm danh tour này.';
    case 'UNAUTHENTICATED':
    case 'TOKEN_INVALID':
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 'VALIDATION_ERROR':
      return 'Mã vé không hợp lệ.';
    case 'CONCURRENT_UPDATE':
      return 'Dữ liệu vừa thay đổi, vui lòng thử lại.';
    case 'INVALID_STATE_TRANSITION':
      return 'Phân công đã được xử lý trước đó. Vui lòng tải lại danh sách.';
    case 'CONFLICT':
      return 'Dữ liệu vừa thay đổi, vui lòng thử lại.';
    case 'NETWORK_ERROR':
      return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.';
    default:
      return 'Không xử lý được yêu cầu. Vui lòng thử lại.';
  }
}
