import 'dart:math';
import 'package:equatable/equatable.dart';
import 'package:intl/intl.dart';
import '../models/booking_create_model.dart';
import '../models/booking_voucher_model.dart';

class BookingCreateState extends Equatable {
  // Thông tin tour & chuyến đi
  final String tourId;
  final String departureId;
  final String tourTitle;
  final int departurePrice; // Đơn giá 1 khách (VND)
  final int remainingSeats; // Số chỗ trống còn lại
  final DateTime? departureDate;

  // Form liên hệ
  final String fullName;
  final String phone;
  final String notes;
  final int participants;

  // Lỗi validation
  final String? fullNameError;
  final String? phoneError;
  final String? generalError;
  final String? voucherError;

  // Voucher & Khuyến mãi
  final List<VoucherItemModel> vouchers;
  final VoucherItemModel? selectedVoucher;
  final PromotionPreviewResult? previewResult;

  // Trạng thái xử lý
  final bool isLoadingVouchers;
  final bool isPreviewingVoucher;
  final bool isSubmitting;
  final bool submitSuccess;
  final BookingCreatedModel? createdBooking;

  // Chống gửi trùng lặp
  final String clientRequestId;

  const BookingCreateState({
    this.tourId = '',
    this.departureId = '',
    this.tourTitle = '',
    this.departurePrice = 0,
    this.remainingSeats = 1,
    this.departureDate,
    this.fullName = '',
    this.phone = '',
    this.notes = '',
    this.participants = 1,
    this.fullNameError,
    this.phoneError,
    this.generalError,
    this.voucherError,
    this.vouchers = const [],
    this.selectedVoucher,
    this.previewResult,
    this.isLoadingVouchers = false,
    this.isPreviewingVoucher = false,
    this.isSubmitting = false,
    this.submitSuccess = false,
    this.createdBooking,
    this.clientRequestId = '',
  });

  /// Giá gốc tạm tính: đơn giá × số khách (VND)
  int get estimatedSubtotal => departurePrice * participants;

  /// Số tiền giảm giá từ voucher preview (VND)
  int get discountAmount => previewResult?.discountAmount ?? 0;

  /// Tổng tiền tạm tính sau khi trừ giảm giá (VND, tối thiểu 0)
  int get estimatedTotal => max(0, estimatedSubtotal - discountAmount);

  /// Định dạng chuỗi tiền VND
  String get formattedSubtotal =>
      '${NumberFormat('#,###', 'vi_VN').format(estimatedSubtotal)} ₫';

  String get formattedDiscount =>
      '${NumberFormat('#,###', 'vi_VN').format(discountAmount)} ₫';

  String get formattedTotal =>
      '${NumberFormat('#,###', 'vi_VN').format(estimatedTotal)} ₫';

  /// Kiểm tra tính hợp lệ của form đặt tour
  bool get isFormValid {
    if (fullName.trim().length < 2) return false;
    final phoneRegex = RegExp(r'^\+?[0-9 ().-]{6,20}$');
    if (!phoneRegex.hasMatch(phone.trim())) return false;
    if (participants < 1 || participants > remainingSeats) return false;
    return true;
  }

  BookingCreateState copyWith({
    String? tourId,
    String? departureId,
    String? tourTitle,
    int? departurePrice,
    int? remainingSeats,
    DateTime? departureDate,
    String? fullName,
    String? phone,
    String? notes,
    int? participants,
    String? fullNameError,
    bool clearFullNameError = false,
    String? phoneError,
    bool clearPhoneError = false,
    String? generalError,
    bool clearGeneralError = false,
    String? voucherError,
    bool clearVoucherError = false,
    List<VoucherItemModel>? vouchers,
    VoucherItemModel? selectedVoucher,
    bool clearSelectedVoucher = false,
    PromotionPreviewResult? previewResult,
    bool clearPreviewResult = false,
    bool? isLoadingVouchers,
    bool? isPreviewingVoucher,
    bool? isSubmitting,
    bool? submitSuccess,
    BookingCreatedModel? createdBooking,
    String? clientRequestId,
  }) {
    return BookingCreateState(
      tourId: tourId ?? this.tourId,
      departureId: departureId ?? this.departureId,
      tourTitle: tourTitle ?? this.tourTitle,
      departurePrice: departurePrice ?? this.departurePrice,
      remainingSeats: remainingSeats ?? this.remainingSeats,
      departureDate: departureDate ?? this.departureDate,
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      notes: notes ?? this.notes,
      participants: participants ?? this.participants,
      fullNameError: clearFullNameError ? null : (fullNameError ?? this.fullNameError),
      phoneError: clearPhoneError ? null : (phoneError ?? this.phoneError),
      generalError: clearGeneralError ? null : (generalError ?? this.generalError),
      voucherError: clearVoucherError ? null : (voucherError ?? this.voucherError),
      vouchers: vouchers ?? this.vouchers,
      selectedVoucher: clearSelectedVoucher ? null : (selectedVoucher ?? this.selectedVoucher),
      previewResult: clearPreviewResult ? null : (previewResult ?? this.previewResult),
      isLoadingVouchers: isLoadingVouchers ?? this.isLoadingVouchers,
      isPreviewingVoucher: isPreviewingVoucher ?? this.isPreviewingVoucher,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitSuccess: submitSuccess ?? this.submitSuccess,
      createdBooking: createdBooking ?? this.createdBooking,
      clientRequestId: clientRequestId ?? this.clientRequestId,
    );
  }

  @override
  List<Object?> get props => [
        tourId,
        departureId,
        tourTitle,
        departurePrice,
        remainingSeats,
        departureDate,
        fullName,
        phone,
        notes,
        participants,
        fullNameError,
        phoneError,
        generalError,
        voucherError,
        vouchers,
        selectedVoucher,
        previewResult,
        isLoadingVouchers,
        isPreviewingVoucher,
        isSubmitting,
        submitSuccess,
        createdBooking,
        clientRequestId,
      ];
}

