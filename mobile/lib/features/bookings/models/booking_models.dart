import 'package:equatable/equatable.dart';

/// Trạng thái đơn đặt chỗ phía backend (`BOOKING_STATUS`), cũng là 4 tab của màn "Đơn đặt".
enum BookingStatus {
  pending('PENDING', 'Chờ thanh toán'),
  confirmed('CONFIRMED', 'Đã xác nhận'),
  completed('COMPLETED', 'Đã hoàn thành'),
  cancelled('CANCELLED', 'Đã hủy');

  final String apiValue;
  final String label;
  const BookingStatus(this.apiValue, this.label);

  static BookingStatus parse(String? raw) =>
      BookingStatus.values.firstWhere((s) => s.apiValue == raw, orElse: () => BookingStatus.pending);
}

/// Một phần tử của `GET /bookings/me` / `GET /bookings/:id`.
class BookingItem extends Equatable {
  final String id;
  final String bookingCode;
  final BookingStatus status;
  final String tourId;
  final String tourTitle;
  final DateTime departureDate;
  final DateTime endDate;
  final int participants;
  final int totalAmount;
  final bool isPaid;
  final bool refundRequired;
  final DateTime? paymentExpiresAt;
  final String? cancelReason;

  const BookingItem({
    required this.id,
    required this.bookingCode,
    required this.status,
    required this.tourId,
    required this.tourTitle,
    required this.departureDate,
    required this.endDate,
    required this.participants,
    required this.totalAmount,
    required this.isPaid,
    required this.refundRequired,
    this.paymentExpiresAt,
    this.cancelReason,
  });

  factory BookingItem.fromJson(Map<String, dynamic> json) {
    final tour = json['tour'] as Map<String, dynamic>? ?? const {};
    final expires = json['paymentExpiresAt'] as String?;
    return BookingItem(
      id: json['id'] as String,
      bookingCode: json['bookingCode'] as String? ?? '',
      status: BookingStatus.parse(json['status'] as String?),
      tourId: tour['id'] as String? ?? '',
      tourTitle: tour['title'] as String? ?? '',
      departureDate: DateTime.parse(json['departureDate'] as String),
      endDate: DateTime.parse(json['endDate'] as String),
      participants: (json['participants'] as num?)?.toInt() ?? 1,
      totalAmount: (json['totalAmount'] as num?)?.toInt() ?? 0,
      isPaid: json['isPaid'] as bool? ?? false,
      refundRequired: json['refundRequired'] as bool? ?? false,
      paymentExpiresAt: expires == null ? null : DateTime.parse(expires),
      cancelReason: json['cancelReason'] as String?,
    );
  }

  @override
  List<Object?> get props => [
        id, bookingCode, status, tourId, tourTitle, departureDate, endDate, participants,
        totalAmount, isPaid, refundRequired, paymentExpiresAt, cancelReason,
      ];
}

/// Một trang của danh sách phân trang (`data` + `meta`).
class PagedResult<T> {
  final List<T> items;
  final int page;
  final int totalPages;
  final int total;

  const PagedResult({required this.items, required this.page, required this.totalPages, required this.total});

  bool get hasMore => page < totalPages;
}

/// Trạng thái vé điện tử (`ETICKET_STATUS`).
enum ETicketStatus {
  valid('VALID', 'Hợp lệ'),
  used('USED', 'Đã sử dụng'),
  cancelled('CANCELLED', 'Đã vô hiệu hóa');

  final String apiValue;
  final String label;
  const ETicketStatus(this.apiValue, this.label);

  static ETicketStatus parse(String? raw) =>
      ETicketStatus.values.firstWhere((s) => s.apiValue == raw, orElse: () => ETicketStatus.valid);
}

/// `GET /e-tickets/booking/:bookingId`. `code` (ETK-…) chính là chuỗi được mã hóa trong QR.
class ETicket extends Equatable {
  final String id;
  final String code;
  final ETicketStatus status;
  final String bookingId;
  final String bookingCode;
  final String tourTitle;
  final String? destination;
  final String? meetingPoint;
  final DateTime departureDate;
  final int participants;
  final String holderName;
  final String? contactPhone;

  const ETicket({
    required this.id,
    required this.code,
    required this.status,
    required this.bookingId,
    required this.bookingCode,
    required this.tourTitle,
    required this.departureDate,
    required this.participants,
    required this.holderName,
    this.destination,
    this.meetingPoint,
    this.contactPhone,
  });

  factory ETicket.fromJson(Map<String, dynamic> json) {
    final booking = json['booking'] as Map<String, dynamic>? ?? const {};
    final tour = json['tour'] as Map<String, dynamic>? ?? const {};
    return ETicket(
      id: json['id'] as String,
      code: json['code'] as String,
      status: ETicketStatus.parse(json['status'] as String?),
      bookingId: booking['id'] as String? ?? '',
      bookingCode: booking['code'] as String? ?? '',
      tourTitle: tour['title'] as String? ?? '',
      destination: tour['destination'] as String?,
      meetingPoint: tour['meetingPoint'] as String?,
      departureDate: DateTime.parse(json['departureDate'] as String),
      participants: (json['participants'] as num?)?.toInt() ?? 1,
      holderName: json['holderName'] as String? ?? '',
      contactPhone: booking['contactPhone'] as String?,
    );
  }

  /// Dùng khi lưu cache offline; cùng cấu trúc với `fromJson`.
  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'status': status.apiValue,
        'booking': {'id': bookingId, 'code': bookingCode, 'contactPhone': contactPhone},
        'tour': {'title': tourTitle, 'destination': destination, 'meetingPoint': meetingPoint},
        'departureDate': departureDate.toIso8601String(),
        'participants': participants,
        'holderName': holderName,
      };

  ETicket copyWith({ETicketStatus? status}) => ETicket(
        id: id,
        code: code,
        status: status ?? this.status,
        bookingId: bookingId,
        bookingCode: bookingCode,
        tourTitle: tourTitle,
        destination: destination,
        meetingPoint: meetingPoint,
        departureDate: departureDate,
        participants: participants,
        holderName: holderName,
        contactPhone: contactPhone,
      );

  @override
  List<Object?> get props =>
      [id, code, status, bookingId, bookingCode, tourTitle, destination, meetingPoint, departureDate, participants, holderName, contactPhone];
}

/// Vé kèm cờ cho biết dữ liệu lấy từ cache offline (không có mạng).
class TicketResult {
  final ETicket ticket;
  final bool fromCache;
  const TicketResult(this.ticket, {this.fromCache = false});
}

/// Xem trước kết quả hủy, tính theo đúng quy tắc của backend (`BookingsService.cancelMine`):
/// - PENDING: hủy bất cứ lúc nào, chưa thu tiền nên không có hoàn tiền.
/// - CONFIRMED: chỉ hủy được khi còn nhiều hơn `cancellationWindowHours` giờ trước ngày khởi hành;
///   khi đó đơn đã thanh toán được đánh dấu `refundRequired` và hoàn toàn bộ `totalAmount`.
/// Backend không có mức phạt theo bậc, nên không bao giờ suy ra phần trăm khác 0% hoặc 100%.
class CancellationPreview extends Equatable {
  final bool canCancel;
  final int refundAmount;
  final int penaltyAmount;
  final int daysLeft;
  final int windowHours;
  final String message;

  const CancellationPreview({
    required this.canCancel,
    required this.refundAmount,
    required this.penaltyAmount,
    required this.daysLeft,
    required this.windowHours,
    required this.message,
  });

  /// Mặc định của backend khi chưa cấu hình `cancellation.cancellationWindowHours`.
  static const int defaultWindowHours = 24;

  factory CancellationPreview.forBooking(BookingItem booking, {required int windowHours, required DateTime now}) {
    final hoursLeft = booking.departureDate.difference(now).inMinutes / 60;
    final daysLeft = hoursLeft <= 0 ? 0 : (hoursLeft / 24).floor();
    if (booking.status == BookingStatus.pending) {
      return CancellationPreview(
        canCancel: true,
        refundAmount: 0,
        penaltyAmount: 0,
        daysLeft: daysLeft,
        windowHours: windowHours,
        message: 'Đơn chưa thanh toán nên không phát sinh phí hủy. Chỗ giữ sẽ được giải phóng ngay.',
      );
    }
    if (booking.status != BookingStatus.confirmed) {
      return CancellationPreview(
        canCancel: false,
        refundAmount: 0,
        penaltyAmount: 0,
        daysLeft: daysLeft,
        windowHours: windowHours,
        message: 'Đơn này không thể hủy.',
      );
    }
    if (hoursLeft < windowHours) {
      return CancellationPreview(
        canCancel: false,
        refundAmount: 0,
        penaltyAmount: booking.totalAmount,
        daysLeft: daysLeft,
        windowHours: windowHours,
        message: 'Đã quá hạn hủy: đơn đã xác nhận chỉ được hủy trước ngày khởi hành hơn $windowHours giờ.',
      );
    }
    return CancellationPreview(
      canCancel: true,
      refundAmount: booking.totalAmount,
      penaltyAmount: 0,
      daysLeft: daysLeft,
      windowHours: windowHours,
      message: 'Còn $daysLeft ngày trước khởi hành: bạn được hoàn 100% và hệ thống sẽ tiến hành hoàn tiền.',
    );
  }

  @override
  List<Object?> get props => [canCancel, refundAmount, penaltyAmount, daysLeft, windowHours, message];
}
