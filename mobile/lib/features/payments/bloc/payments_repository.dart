import 'package:dio/dio.dart';
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

  PaymentsRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<CheckoutInfo> createCheckout(String bookingId) => _guard(() async {
        final res = await _api.post<Map<String, dynamic>>(ApiEndpoints.bookingCheckout(bookingId));
        return CheckoutInfo.fromJson(_data(res));
      });

  Future<PaymentSnapshot> getPayment(String paymentId) => _guard(() async {
        final res = await _api.get<Map<String, dynamic>>(ApiEndpoints.paymentDetail(paymentId));
        return PaymentSnapshot.fromJson(_data(res));
      });

  Future<BookingSummary> getBooking(String bookingId) => _guard(() async {
        final res = await _api.get<Map<String, dynamic>>(ApiEndpoints.bookingDetail(bookingId));
        return BookingSummary.fromJson(_data(res));
      });

  Map<String, dynamic> _data(Response<Map<String, dynamic>> res) => res.data!['data'] as Map<String, dynamic>;

  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on DioException catch (e) {
      final body = e.response?.data;
      String? serverMessage;
      if (body is Map && body['error'] is Map) {
        final message = (body['error'] as Map)['message'];
        if (message is String) serverMessage = message;
      }
      throw PaymentException(switch (e.response?.statusCode) {
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
