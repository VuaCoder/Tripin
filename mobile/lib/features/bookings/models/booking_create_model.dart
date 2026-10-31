import 'dart:math';
import 'package:equatable/equatable.dart';
import 'package:intl/intl.dart';

/// [FLOW-09 AC2] Cấu trúc phân loại hành khách theo nhóm tuổi
class GuestCounts extends Equatable {
  final int adults; // Người lớn (>= 12 tuổi)
  final int children; // Trẻ em (2 - 11 tuổi)
  final int infants; // Em bé (< 2 tuổi)

  const GuestCounts({
    this.adults = 1,
    this.children = 0,
    this.infants = 0,
  });

  int get total => adults + children + infants;

  Map<String, dynamic> toJson() => {
        'adults': adults,
        'children': children,
        'infants': infants,
      };

  factory GuestCounts.fromJson(Map<String, dynamic> json) => GuestCounts(
        adults: (json['adults'] as num?)?.toInt() ?? 1,
        children: (json['children'] as num?)?.toInt() ?? 0,
        infants: (json['infants'] as num?)?.toInt() ?? 0,
      );

  GuestCounts copyWith({
    int? adults,
    int? children,
    int? infants,
  }) {
    return GuestCounts(
      adults: adults ?? this.adults,
      children: children ?? this.children,
      infants: infants ?? this.infants,
    );
  }

  @override
  List<Object?> get props => [adults, children, infants];
}

/// [FLOW-09 AC5] Thông tin người liên hệ cho đơn đặt tour (bắt buộc Họ tên, SĐT, Email)
class BookingContactModel extends Equatable {
  final String fullName;
  final String phone;
  final String email;

  const BookingContactModel({
    required this.fullName,
    required this.phone,
    this.email = '',
  });

  Map<String, dynamic> toJson() => {
        'fullName': fullName.trim(),
        'phone': phone.trim(),
        if (email.trim().isNotEmpty) 'email': email.trim(),
      };

  factory BookingContactModel.fromJson(Map<String, dynamic> json) => BookingContactModel(
        fullName: (json['fullName'] ?? '').toString(),
        phone: (json['phone'] ?? '').toString(),
        email: (json['email'] ?? '').toString(),
      );

  @override
  List<Object?> get props => [fullName, phone, email];
}

/// Request body gửi lên backend `POST /api/v1/bookings`.
/// QUY TẮC: Client KHÔNG tự tính và KHÔNG gửi trường giá lên server.
class BookingCreateRequest extends Equatable {
  final String tourId;
  final String departureId;
  final int participants;
  final GuestCounts? guestCounts;
  final BookingContactModel contact;
  final String? notes;
  final String? promotionCode;
  final String? agencyPromotionCode;
  final String? platformPromotionCode;
  final String clientRequestId;

  const BookingCreateRequest({
    required this.tourId,
    required this.departureId,
    required this.participants,
    this.guestCounts,
    required this.contact,
    this.notes,
    this.promotionCode,
    this.agencyPromotionCode,
    this.platformPromotionCode,
    required this.clientRequestId,
  });

  /// Sinh clientRequestId ngẫu nhiên chuẩn 32 ký tự hex (đáp ứng regex: ^[A-Za-z0-9_-]{8,64}$)
  static String generateClientRequestId() {
    final random = Random.secure();
    final values = List<int>.generate(16, (i) => random.nextInt(256));
    // Set UUID v4 flags
    values[6] = (values[6] & 0x0f) | 0x40;
    values[8] = (values[8] & 0x3f) | 0x80;
    return values.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'tourId': tourId,
      'departureId': departureId,
      'participants': participants,
      'contact': {
        'fullName': contact.fullName.trim(),
        'phone': contact.phone.trim(),
      },
      'clientRequestId': clientRequestId,
    };

    if (guestCounts != null) {
      map['guestCounts'] = guestCounts!.toJson();
    }

    final combinedNotes = [
      if (notes != null && notes!.trim().isNotEmpty) notes!.trim(),
      if (contact.email.trim().isNotEmpty) 'Email khách: ${contact.email.trim()}',
    ].join('\n');

    if (combinedNotes.isNotEmpty) {
      map['notes'] = combinedNotes;
    }

    if (promotionCode != null && promotionCode!.trim().isNotEmpty) {
      map['promotionCode'] = promotionCode!.trim().toUpperCase();
    }
    if (agencyPromotionCode != null && agencyPromotionCode!.trim().isNotEmpty) {
      map['agencyPromotionCode'] = agencyPromotionCode!.trim().toUpperCase();
    }
    if (platformPromotionCode != null && platformPromotionCode!.trim().isNotEmpty) {
      map['platformPromotionCode'] = platformPromotionCode!.trim().toUpperCase();
    }

    return map;
  }

  @override
  List<Object?> get props => [
        tourId,
        departureId,
        participants,
        guestCounts,
        contact,
        notes,
        promotionCode,
        agencyPromotionCode,
        platformPromotionCode,
        clientRequestId,
      ];
}

/// Dữ liệu đơn đặt chỗ thành công trả về từ Backend (BookingDto)
class BookingCreatedModel extends Equatable {
  final String id;
  final String bookingCode;
  final String status; // PENDING
  final String tourTitle;
  final String departureId;
  final DateTime? departureDate;
  final DateTime? endDate;
  final int participants;
  final int unitPrice; // Số nguyên VND
  final int subtotal; // Số nguyên VND
  final int discountAmount; // Số nguyên VND
  final int totalAmount; // Số nguyên VND
  final String contactName;
  final String contactPhone;
  final String? notes;
  final bool isPaid;
  final DateTime? paymentExpiresAt;
  final DateTime? createdAt;

  const BookingCreatedModel({
    required this.id,
    required this.bookingCode,
    required this.status,
    required this.tourTitle,
    required this.departureId,
    this.departureDate,
    this.endDate,
    required this.participants,
    required this.unitPrice,
    required this.subtotal,
    required this.discountAmount,
    required this.totalAmount,
    required this.contactName,
    required this.contactPhone,
    this.notes,
    this.isPaid = false,
    this.paymentExpiresAt,
    this.createdAt,
  });

  factory BookingCreatedModel.fromJson(Map<String, dynamic> json) {
    final tourMap = json['tour'] is Map<String, dynamic> ? json['tour'] as Map<String, dynamic> : const {};
    final contactMap = json['contact'] is Map<String, dynamic> ? json['contact'] as Map<String, dynamic> : const {};

    return BookingCreatedModel(
      id: (json['id'] ?? '').toString(),
      bookingCode: (json['bookingCode'] ?? '').toString(),
      status: (json['status'] ?? 'PENDING').toString(),
      tourTitle: (tourMap['title'] ?? json['tourTitle'] ?? 'Chuyến du lịch').toString(),
      departureId: (json['departureId'] ?? '').toString(),
      departureDate: json['departureDate'] != null ? DateTime.tryParse(json['departureDate'].toString()) : null,
      endDate: json['endDate'] != null ? DateTime.tryParse(json['endDate'].toString()) : null,
      participants: (json['participants'] as num?)?.toInt() ?? 1,
      unitPrice: (json['unitPrice'] as num?)?.toInt() ?? 0,
      subtotal: (json['subtotal'] as num?)?.toInt() ?? 0,
      discountAmount: (json['discountAmount'] as num?)?.toInt() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toInt() ?? 0,
      contactName: (contactMap['fullName'] ?? json['contactName'] ?? '').toString(),
      contactPhone: (contactMap['phone'] ?? json['contactPhone'] ?? '').toString(),
      notes: json['notes']?.toString(),
      isPaid: json['isPaid'] == true,
      paymentExpiresAt: json['paymentExpiresAt'] != null ? DateTime.tryParse(json['paymentExpiresAt'].toString()) : null,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }

  /// Định dạng tiền VND chuẩn tiếng Việt (VD: "1.500.000 ₫")
  String get formattedTotalAmount {
    return '${NumberFormat('#,###', 'vi_VN').format(totalAmount)} ₫';
  }

  String get formattedSubtotal {
    return '${NumberFormat('#,###', 'vi_VN').format(subtotal)} ₫';
  }

  String get formattedDiscountAmount {
    return '${NumberFormat('#,###', 'vi_VN').format(discountAmount)} ₫';
  }

  /// Định dạng ngày giờ hạn thanh toán (VD: "14:30 01/11/2026")
  String get formattedPaymentExpiresAt {
    if (paymentExpiresAt == null) return '15 phút kể từ lúc đặt';
    return DateFormat('HH:mm dd/MM/yyyy').format(paymentExpiresAt!.toLocal());
  }

  /// Định dạng ngày khởi hành
  String get formattedDepartureDate {
    if (departureDate == null) return '';
    return DateFormat('dd/MM/yyyy').format(departureDate!.toLocal());
  }

  @override
  List<Object?> get props => [
        id,
        bookingCode,
        status,
        tourTitle,
        departureId,
        departureDate,
        endDate,
        participants,
        unitPrice,
        subtotal,
        discountAmount,
        totalAmount,
        contactName,
        contactPhone,
        notes,
        isPaid,
        paymentExpiresAt,
        createdAt,
      ];
}
