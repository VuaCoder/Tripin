import 'package:equatable/equatable.dart';
import '../models/booking_voucher_model.dart';

abstract class BookingCreateEvent extends Equatable {
  const BookingCreateEvent();

  @override
  List<Object?> get props => [];
}

/// Khởi tạo dữ liệu màn hình đặt tour
class BookingCreateInitEvent extends BookingCreateEvent {
  final String tourId;
  final String departureId;
  final String tourTitle;
  final int departurePrice; // Giá 1 khách (VND)
  final int remainingSeats; // Số chỗ trống còn lại
  final DateTime? departureDate;
  final String? initialFullName;
  final String? initialPhone;
  final String? initialEmail;

  const BookingCreateInitEvent({
    required this.tourId,
    required this.departureId,
    required this.tourTitle,
    required this.departurePrice,
    required this.remainingSeats,
    this.departureDate,
    this.initialFullName,
    this.initialPhone,
    this.initialEmail,
  });

  @override
  List<Object?> get props => [
        tourId,
        departureId,
        tourTitle,
        departurePrice,
        remainingSeats,
        departureDate,
        initialFullName,
        initialPhone,
        initialEmail,
      ];
}

/// Người dùng thay đổi thông tin liên hệ (Họ tên, SĐT, Email, Ghi chú)
class BookingCreateContactChangedEvent extends BookingCreateEvent {
  final String? fullName;
  final String? phone;
  final String? email;
  final String? notes;

  const BookingCreateContactChangedEvent({
    this.fullName,
    this.phone,
    this.email,
    this.notes,
  });

  @override
  List<Object?> get props => [fullName, phone, email, notes];
}

/// [FLOW-09 AC2] Người dùng thay đổi số lượng khách theo từng nhóm đối tượng
class BookingCreateGuestsChangedEvent extends BookingCreateEvent {
  final int adults;
  final int children;
  final int infants;

  const BookingCreateGuestsChangedEvent({
    required this.adults,
    required this.children,
    required this.infants,
  });

  @override
  List<Object?> get props => [adults, children, infants];
}

/// Người dùng thay đổi tổng số lượng khách tham gia (hỗ trợ tương thích ngược)
class BookingCreateParticipantsChangedEvent extends BookingCreateEvent {
  final int participants;

  const BookingCreateParticipantsChangedEvent(this.participants);

  @override
  List<Object?> get props => [participants];
}

/// Người dùng nhập mã khuyến mãi thủ công và bấm áp dụng
class BookingCreateApplyVoucherCodeEvent extends BookingCreateEvent {
  final String code;

  const BookingCreateApplyVoucherCodeEvent(this.code);

  @override
  List<Object?> get props => [code];
}

/// Người dùng chọn một voucher từ danh sách ví voucher
class BookingCreateSelectVoucherItemEvent extends BookingCreateEvent {
  final VoucherItemModel voucher;

  const BookingCreateSelectVoucherItemEvent(this.voucher);

  @override
  List<Object?> get props => [voucher];
}

/// Người dùng gỡ bỏ voucher đang áp dụng
class BookingCreateRemoveVoucherEvent extends BookingCreateEvent {
  const BookingCreateRemoveVoucherEvent();
}

/// Tải lại danh sách ví voucher của người dùng
class BookingCreateLoadVouchersEvent extends BookingCreateEvent {
  const BookingCreateLoadVouchersEvent();
}

/// Người dùng nhấn nút "Đặt tour" để gửi đơn
class BookingCreateSubmitEvent extends BookingCreateEvent {
  const BookingCreateSubmitEvent();
}
