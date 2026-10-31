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

  const BookingCreateInitEvent({
    required this.tourId,
    required this.departureId,
    required this.tourTitle,
    required this.departurePrice,
    required this.remainingSeats,
    this.departureDate,
    this.initialFullName,
    this.initialPhone,
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
      ];
}

/// Người dùng thay đổi thông tin liên hệ
class BookingCreateContactChangedEvent extends BookingCreateEvent {
  final String? fullName;
  final String? phone;
  final String? notes;

  const BookingCreateContactChangedEvent({
    this.fullName,
    this.phone,
    this.notes,
  });

  @override
  List<Object?> get props => [fullName, phone, notes];
}

/// Người dùng thay đổi số lượng khách tham gia
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

