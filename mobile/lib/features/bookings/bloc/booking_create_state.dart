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
  final int departurePrice; // Đơn giá 1 người lớn (VND)
  final int remainingSeats; // Số chỗ trống còn lại
  final DateTime? departureDate;

  // Form liên hệ
  final String fullName;
  final String phone;
  final String email;
  final String notes;

  // [FLOW-09 AC2] Phân loại khách
  final int adults;
  final int children;
  final int infants;
  final int participants; // Tổng khách (tương thích ngược)

  // Lỗi validation
  final String? fullNameError;
  final String? phoneError;
  final String? emailError;
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
    this.email = '',
    this.notes = '',
    this.adults = 1,
    this.children = 0,
    this.infants = 0,
    this.participants = 1,
    this.fullNameError,
    this.phoneError,
    this.emailError,
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

  /// Tổng số khách thực tế
  int get totalGuests => adults + children + infants;

  /// Cấu trúc GuestCounts
  GuestCounts get guestCounts => GuestCounts(adults: adults, children: children, infants: infants);

  /// Đơn giá theo từng đối tượng:
  /// - Người lớn: 100% đơn giá chuyến
  /// - Trẻ em (2 - 11 tuổi): 70% đơn giá chuyến
  /// - Em bé (< 2 tuổi): Miễn phí (0đ)
  int get adultPrice => departurePrice;
  int get childPrice => (departurePrice * 0.7).round();
  int get infantPrice => 0;

  /// Giá gốc tạm tính: (Người lớn × Giá NL) + (Trẻ em × Giá TE) + (Em bé × Giá EB)
  int get estimatedSubtotal => (adults * adultPrice) + (children * childPrice) + (infants * infantPrice);

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

  String get formattedAdultTotal =>
      '${NumberFormat('#,###', 'vi_VN').format(adults * adultPrice)} ₫';

  String get formattedChildTotal =>
      '${NumberFormat('#,###', 'vi_VN').format(children * childPrice)} ₫';

  String get formattedInfantTotal =>
      infants * infantPrice == 0 ? 'Miễn phí' : '${NumberFormat('#,###', 'vi_VN').format(infants * infantPrice)} ₫';

  /// [FLOW-09 AC5] Kiểm tra tính hợp lệ của form đặt tour (Họ tên, SĐT, Email)
  bool get isFormValid {
    if (fullName.trim().length < 2) return false;
    final phoneRegex = RegExp(r'^\+?[0-9 ().-]{6,20}$');
    if (!phoneRegex.hasMatch(phone.trim())) return false;
    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    if (!emailRegex.hasMatch(email.trim())) return false;
    if (adults < 1) return false;
    if (totalGuests < 1 || totalGuests > remainingSeats) return false;
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
    String? email,
    String? notes,
    int? adults,
    int? children,
    int? infants,
    int? participants,
    String? fullNameError,
    bool clearFullNameError = false,
    String? phoneError,
    bool clearPhoneError = false,
    String? emailError,
    bool clearEmailError = false,
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
    final nextAdults = adults ?? this.adults;
    final nextChildren = children ?? this.children;
    final nextInfants = infants ?? this.infants;
    final nextTotal = participants ?? (nextAdults + nextChildren + nextInfants);

    return BookingCreateState(
      tourId: tourId ?? this.tourId,
      departureId: departureId ?? this.departureId,
      tourTitle: tourTitle ?? this.tourTitle,
      departurePrice: departurePrice ?? this.departurePrice,
      remainingSeats: remainingSeats ?? this.remainingSeats,
      departureDate: departureDate ?? this.departureDate,
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      notes: notes ?? this.notes,
      adults: nextAdults,
      children: nextChildren,
      infants: nextInfants,
      participants: nextTotal,
      fullNameError: clearFullNameError ? null : (fullNameError ?? this.fullNameError),
      phoneError: clearPhoneError ? null : (phoneError ?? this.phoneError),
      emailError: clearEmailError ? null : (emailError ?? this.emailError),
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
        email,
        notes,
        adults,
        children,
        infants,
        participants,
        fullNameError,
        phoneError,
        emailError,
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
