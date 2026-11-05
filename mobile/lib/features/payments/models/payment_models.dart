import 'package:equatable/equatable.dart';

/// Thông tin chuyển khoản VietQR do backend trả về khi tạo link PayOS.
class BankTransferInfo extends Equatable {
  final String qrCode;
  final String accountNumber;
  final String accountName;
  final String bin;
  final String description;

  const BankTransferInfo({
    required this.qrCode,
    required this.accountNumber,
    required this.accountName,
    required this.bin,
    required this.description,
  });

  factory BankTransferInfo.fromJson(Map<String, dynamic> json) => BankTransferInfo(
        qrCode: json['qrCode'] as String? ?? '',
        accountNumber: json['accountNumber'] as String? ?? '',
        accountName: json['accountName'] as String? ?? '',
        bin: json['bin'] as String? ?? '',
        description: json['description'] as String? ?? '',
      );

  @override
  List<Object?> get props => [qrCode, accountNumber, accountName, bin, description];
}

/// Kết quả `POST /payments/bookings/:bookingId/checkout`.
class CheckoutInfo extends Equatable {
  final String paymentId;
  final String checkoutUrl;
  final int amount;
  final DateTime expiresAt;
  final BankTransferInfo? bankTransfer;

  const CheckoutInfo({
    required this.paymentId,
    required this.checkoutUrl,
    required this.amount,
    required this.expiresAt,
    this.bankTransfer,
  });

  factory CheckoutInfo.fromJson(Map<String, dynamic> json) => CheckoutInfo(
        paymentId: json['paymentId'] as String,
        checkoutUrl: json['checkoutUrl'] as String,
        amount: (json['amount'] as num).toInt(),
        expiresAt: DateTime.parse(json['expiresAt'] as String),
        bankTransfer: json['bankTransfer'] is Map<String, dynamic>
            ? BankTransferInfo.fromJson(json['bankTransfer'] as Map<String, dynamic>)
            : null,
      );

  @override
  List<Object?> get props => [paymentId, checkoutUrl, amount, expiresAt, bankTransfer];
}

/// Trạng thái payment phía backend (`PAYMENT_STATUS`).
enum PaymentStatus {
  pending,
  paid,
  cancelled,
  expired,
  failed;

  static PaymentStatus parse(String? raw) => switch (raw) {
        'PAID' => PaymentStatus.paid,
        'CANCELLED' => PaymentStatus.cancelled,
        'EXPIRED' => PaymentStatus.expired,
        'FAILED' => PaymentStatus.failed,
        _ => PaymentStatus.pending,
      };

  bool get isFinalFailure => this == cancelled || this == expired || this == failed;
}

/// Kết quả `GET /payments/:id`.
class PaymentSnapshot extends Equatable {
  final String id;
  final PaymentStatus status;
  final DateTime expiresAt;

  const PaymentSnapshot({required this.id, required this.status, required this.expiresAt});

  factory PaymentSnapshot.fromJson(Map<String, dynamic> json) => PaymentSnapshot(
        id: json['id'] as String,
        status: PaymentStatus.parse(json['status'] as String?),
        expiresAt: DateTime.parse(json['expiresAt'] as String),
      );

  @override
  List<Object?> get props => [id, status, expiresAt];
}

/// Phần cần hiển thị của `GET /bookings/:id` ở màn hình thành công.
class BookingSummary extends Equatable {
  final String id;
  final String bookingCode;
  final String status;
  final String tourTitle;
  final int totalAmount;
  final DateTime? departureDate;
  final int participants;
  final String? thumbnailUrl;

  const BookingSummary({
    required this.id,
    required this.bookingCode,
    required this.status,
    required this.tourTitle,
    required this.totalAmount,
    this.departureDate,
    this.participants = 1,
    this.thumbnailUrl,
  });

  bool get isConfirmed => status == 'CONFIRMED' || status == 'COMPLETED';

  factory BookingSummary.fromJson(Map<String, dynamic> json) {
    final tour = json['tour'] is Map<String, dynamic> ? json['tour'] as Map<String, dynamic> : null;
    return BookingSummary(
      id: json['id']?.toString() ?? '',
      bookingCode: json['bookingCode']?.toString() ?? '',
      status: json['status']?.toString() ?? 'CONFIRMED',
      tourTitle: tour?['title']?.toString() ?? json['tourTitle']?.toString() ?? '',
      totalAmount: (json['totalAmount'] as num?)?.toInt() ?? 0,
      departureDate: json['departureDate'] != null ? DateTime.tryParse(json['departureDate'].toString()) : null,
      participants: (json['participants'] as num?)?.toInt() ?? 1,
      thumbnailUrl: json['thumbnailUrl']?.toString() ?? tour?['coverImageUrl']?.toString() ?? tour?['thumbnailUrl']?.toString(),
    );
  }

  @override
  List<Object?> get props => [id, bookingCode, status, tourTitle, totalAmount, departureDate, participants, thumbnailUrl];
}
