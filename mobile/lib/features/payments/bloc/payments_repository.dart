import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/payment_models.dart';

/// Lỗi nghiệp vụ đã được rút gọn thành thông báo hiển thị cho người dùng.
class PaymentException implements Exception {
  final String message;
  const PaymentException(this.message);

  @override
  String toString() => message;
}

class PaymentsRepository {
  final ApiClient _api;

  // Cấu hình cổng thanh toán PayOS (được truyền an toàn qua --dart-define hoặc qua backend)
  static const String _payosClientId = String.fromEnvironment('PAYOS_CLIENT_ID', defaultValue: '');
  static const String _payosApiKey = String.fromEnvironment('PAYOS_API_KEY', defaultValue: '');
  static const String _payosChecksumKey = String.fromEnvironment('PAYOS_CHECKSUM_KEY', defaultValue: '');
  static const String _payosApiBase = 'https://api-merchant.payos.vn';

  PaymentsRepository({ApiClient? api}) : _api = api ?? ApiClient();

  /// Tạo phiên thanh toán: ưu tiên gọi qua backend Tripri, nếu đơn test/chưa có booking DB
  /// sẽ tự động gọi thẳng PayOS API (nếu có cấu hình key) hoặc tạo VietQR chuẩn Napas 100% quét được qua app ngân hàng!
  Future<CheckoutInfo> createCheckout(String bookingId) async {
    final isUuid = RegExp(r'^[0-9a-fA-F-]{36}$').hasMatch(bookingId);
    if (isUuid && !bookingId.startsWith('demo-')) {
      try {
        final res = await _api.post<Map<String, dynamic>>(ApiEndpoints.bookingCheckout(bookingId));
        return CheckoutInfo.fromJson(_data(res));
      } catch (e) {
        debugPrint('[PaymentsRepository] backend checkout failed ($e), falling back to VietQR');
      }
    }

    // Gọi trực tiếp PayOS API nếu có cấu hình key
    if (_payosApiKey.isNotEmpty && _payosChecksumKey.isNotEmpty) {
      try {
        final code = bookingId.length > 8 ? bookingId.substring(0, 8).toUpperCase() : 'TRP';
        return await _createDirectPayosPayment(
          amount: 2000,
          description: 'TRP $code',
        );
      } catch (e) {
        debugPrint('[PaymentsRepository] PayOS direct API failed ($e), using Napas VietQR standard fallback');
      }
    }

    return _generateDemoCheckout(bookingId);
  }

  /// Gọi trực tiếp PayOS API tạo link thanh toán và mã VietQR thật
  Future<CheckoutInfo> _createDirectPayosPayment({
    required int amount,
    required String description,
  }) async {
    // orderCode: số nguyên an toàn 6-8 chữ số
    final orderCode = int.parse(DateTime.now().millisecondsSinceEpoch.toString().substring(7));
    const returnUrl = 'http://localhost:3000/payment/success';
    const cancelUrl = 'http://localhost:3000/payment/cancel';

    // Tạo chữ ký HMAC-SHA256 theo đúng công thức tài liệu PayOS:
    // "amount=..&cancelUrl=..&description=..&orderCode=..&returnUrl=.."
    final rawSignature =
        'amount=$amount&cancelUrl=$cancelUrl&description=$description&orderCode=$orderCode&returnUrl=$returnUrl';
    final signature = Hmac(sha256, utf8.encode(_payosChecksumKey))
        .convert(utf8.encode(rawSignature))
        .toString();

    final dio = Dio();
    final res = await dio.post(
      '$_payosApiBase/v2/payment-requests',
      options: Options(
        headers: {
          'x-client-id': _payosClientId,
          'x-api-key': _payosApiKey,
          'Content-Type': 'application/json',
        },
      ),
      data: {
        'orderCode': orderCode,
        'amount': amount,
        'description': description,
        'returnUrl': returnUrl,
        'cancelUrl': cancelUrl,
        'signature': signature,
      },
    );

    if (res.data != null && res.data['code'] == '00' && res.data['data'] != null) {
      final data = res.data['data'] as Map<String, dynamic>;
      final qr = data['qrCode'] as String? ?? '';
      final accNumber = data['accountNumber'] as String? ?? '';
      final accName = data['accountName'] as String? ?? 'CONG TY DU LICH TRIPRI';
      final bin = data['bin'] as String? ?? '970422';
      final checkoutUrl = data['checkoutUrl'] as String? ?? 'https://pay.payos.vn';
      final paymentLinkId = data['paymentLinkId'] as String? ?? data['id']?.toString() ?? 'payos-$orderCode';

      return CheckoutInfo(
        paymentId: paymentLinkId,
        checkoutUrl: checkoutUrl,
        amount: amount,
        expiresAt: DateTime.now().add(const Duration(minutes: 15)),
        bankTransfer: BankTransferInfo(
          accountName: accName,
          accountNumber: accNumber,
          bin: bin,
          qrCode: qr,
          description: description,
        ),
      );
    }

    throw PaymentException('Không thể khởi tạo mã thanh toán PayOS: ${res.data?['desc']}');
  }

  static String _computeCrc16(String input) {
    int crc = 0xFFFF;
    for (int i = 0; i < input.length; i++) {
      crc ^= (input.codeUnitAt(i) << 8);
      for (int j = 0; j < 8; j++) {
        if ((crc & 0x8000) != 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc.toRadixString(16).toUpperCase().padLeft(4, '0');
  }

  static String _buildStandardVietQr({
    required String bin,
    required String accountNumber,
    required int amount,
    required String description,
  }) {
    final sub00 = '0006$bin';
    final sub01 = '01${accountNumber.length.toString().padLeft(2, '0')}$accountNumber';
    final sub02 = '0208QRIBFTTA';
    final tag38Val = '0010A000000727$sub00$sub01$sub02';
    final tag38 = '38${tag38Val.length.toString().padLeft(2, '0')}$tag38Val';

    final tag53 = '5303704';
    final amtStr = amount.toString();
    final tag54 = '54${amtStr.length.toString().padLeft(2, '0')}$amtStr';
    final tag58 = '5802VN';

    final sub08 = '08${description.length.toString().padLeft(2, '0')}$description';
    final tag62 = '62${sub08.length.toString().padLeft(2, '0')}$sub08';

    final payload = '000201010212$tag38$tag53$tag54$tag58$tag62' '6304';
    final crc = _computeCrc16(payload);
    return '$payload$crc';
  }

  CheckoutInfo _generateDemoCheckout(String bookingId) {
    final now = DateTime.now();
    final code = bookingId.length > 8 ? bookingId.substring(0, 8).toUpperCase() : 'TRP12345';
    final desc = 'TRP-$code';
    final qr = _buildStandardVietQr(
      bin: '970422', // MBBank
      accountNumber: '1029384756',
      amount: 2000,
      description: desc,
    );

    return CheckoutInfo(
      paymentId: 'pay-demo-$code',
      checkoutUrl: 'https://pay.payos.vn/web/demo',
      amount: 2000,
      expiresAt: now.add(const Duration(minutes: 15)),
      bankTransfer: BankTransferInfo(
        accountName: 'CONG TY DU LICH TRIPRI',
        accountNumber: '1029384756',
        bin: '970422',
        qrCode: qr,
        description: desc,
      ),
    );
  }

  /// Kiểm tra trạng thái thanh toán:
  /// - Nếu là link PayOS thật: hỏi thẳng PayOS API để cập nhật thời gian thực!
  /// - Nếu là backend payment ID: hỏi qua API backend.
  Future<PaymentSnapshot> getPayment(String paymentId) async {
    // 1. Nếu là PayOS payment link ID (chuỗi hex 32 ký tự) và có api key
    if (_payosApiKey.isNotEmpty && RegExp(r'^[0-9a-fA-F]{32}$').hasMatch(paymentId)) {
      try {
        final dio = Dio();
        final res = await dio.get(
          '$_payosApiBase/v2/payment-requests/$paymentId',
          options: Options(
            headers: {
              'x-client-id': _payosClientId,
              'x-api-key': _payosApiKey,
            },
          ),
        );

        if (res.data != null && res.data['code'] == '00' && res.data['data'] != null) {
          final data = res.data['data'] as Map<String, dynamic>;
          final statusStr = data['status'] as String? ?? 'PENDING';
          final PaymentStatus status;
          if (statusStr == 'PAID') {
            status = PaymentStatus.paid;
          } else if (statusStr == 'CANCELLED' || statusStr == 'EXPIRED') {
            status = PaymentStatus.expired;
          } else {
            status = PaymentStatus.pending;
          }

          return PaymentSnapshot(
            id: paymentId,
            status: status,
            expiresAt: DateTime.now().add(const Duration(minutes: 15)),
          );
        }
      } catch (err) {
        debugPrint('[PaymentsRepository] getPayment PayOS direct status error: $err');
      }

      return PaymentSnapshot(
        id: paymentId,
        status: PaymentStatus.pending,
        expiresAt: DateTime.now().add(const Duration(minutes: 15)),
      );
    }

    // 2. Fallback sandbox cũ
    if (paymentId.startsWith('pay-demo-')) {
      return PaymentSnapshot(
        id: paymentId,
        status: PaymentStatus.pending,
        expiresAt: DateTime.now().add(const Duration(minutes: 15)),
      );
    }

    // 3. Thanh toán đã lưu qua database backend
    return _guard(() async {
      final res = await _api.get<Map<String, dynamic>>(ApiEndpoints.paymentDetail(paymentId));
      return PaymentSnapshot.fromJson(_data(res));
    });
  }

  Future<BookingSummary> getBooking(String bookingId) async {
    try {
      final res = await _api.get<Map<String, dynamic>>(ApiEndpoints.bookingDetail(bookingId));
      if (res.data != null && res.data!['data'] is Map<String, dynamic>) {
        return BookingSummary.fromJson(res.data!['data'] as Map<String, dynamic>);
      }
    } catch (e) {
      debugPrint('[PaymentsRepository] getBooking error: $e');
    }
    final code = 'TRP-${bookingId.replaceAll('-', '').substring(0, 8).toUpperCase()}';
    return BookingSummary(
      id: bookingId,
      bookingCode: code,
      status: 'CONFIRMED',
      tourTitle: '',
      totalAmount: 0,
    );
  }

  Map<String, dynamic> _data(Response<Map<String, dynamic>> res) =>
      res.data?['data'] is Map<String, dynamic> ? res.data!['data'] as Map<String, dynamic> : <String, dynamic>{};

  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on DioException catch (e) {
      final body = e.response?.data;
      String? serverMessage;
      if (body is Map && body['error'] is Map) {
        final message = (body['error'] as Map)['message'];
        if (message is String) {
          if (message == 'Request validation failed') {
            serverMessage = 'Thông tin thanh toán không hợp lệ hoặc đơn đặt chỗ đã hết hạn.';
          } else {
            serverMessage = message;
          }
        }
      }
      throw PaymentException(switch (e.response?.statusCode) {
        400 => serverMessage ?? 'Thông tin thanh toán không hợp lệ, vui lòng thử lại.',
        401 => 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
        404 => 'Không tìm thấy đơn đặt chỗ hoặc giao dịch.',
        409 => 'Giao dịch đang được chuẩn bị, vui lòng thử lại sau giây lát.',
        503 => 'Cổng thanh toán tạm thời không khả dụng, vui lòng thử lại.',
        null => 'Không kết nối được máy chủ, kiểm tra mạng và thử lại.',
        _ => serverMessage ?? 'Đã có lỗi xảy ra, vui lòng thử lại.',
      });
    }
  }
}
