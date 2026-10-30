import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/booking_models.dart';

/// Lỗi nghiệp vụ đã được rút gọn thành thông báo hiển thị cho người dùng.
class BookingException implements Exception {
  final String message;

  /// true khi lỗi do không có mạng (để quyết định dùng cache offline).
  final bool offline;
  const BookingException(this.message, {this.offline = false});

  @override
  String toString() => message;
}

class BookingsRepository {
  static const _ticketCachePrefix = 'tripri_eticket_';

  final ApiClient _api;

  BookingsRepository({ApiClient? api}) : _api = api ?? ApiClient();

  /// `GET /bookings/me`, phân trang; `status` null = tất cả.
  Future<PagedResult<BookingItem>> listMine({BookingStatus? status, int page = 1, int limit = 10}) => _guard(() async {
        final res = await _api.get<Map<String, dynamic>>(
          ApiEndpoints.myBookings,
          queryParameters: {'page': page, 'limit': limit, if (status != null) 'status': status.apiValue},
        );
        final body = res.data!;
        final meta = body['meta'] as Map<String, dynamic>? ?? const {};
        return PagedResult(
          items: [for (final j in body['data'] as List) BookingItem.fromJson(j as Map<String, dynamic>)],
          page: (meta['page'] as num?)?.toInt() ?? page,
          totalPages: (meta['totalPages'] as num?)?.toInt() ?? 1,
          total: (meta['total'] as num?)?.toInt() ?? 0,
        );
      });

  Future<BookingItem> getBooking(String bookingId) => _guard(() async {
        final res = await _api.get<Map<String, dynamic>>(ApiEndpoints.bookingDetail(bookingId));
        return BookingItem.fromJson(res.data!['data'] as Map<String, dynamic>);
      });

  /// Lấy vé từ server và ghi cache; khi mất mạng trả về bản cache gần nhất (AC3).
  Future<TicketResult> getTicketForBooking(String bookingId) async {
    try {
      final ticket = await _guard(() async {
        final res = await _api.get<Map<String, dynamic>>(ApiEndpoints.eTicketByBooking(bookingId));
        return ETicket.fromJson(res.data!['data'] as Map<String, dynamic>);
      });
      await _writeCache(ticket);
      return TicketResult(ticket);
    } on BookingException catch (e) {
      if (!e.offline) rethrow;
      final cached = await readCachedTicket(bookingId);
      if (cached == null) rethrow;
      return TicketResult(cached, fromCache: true);
    }
  }

  Future<ETicket?> readCachedTicket(String bookingId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_ticketCachePrefix$bookingId');
      if (raw == null) return null;
      return ETicket.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null; // cache hỏng: coi như chưa có
    }
  }

  Future<void> _writeCache(ETicket ticket) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_ticketCachePrefix${ticket.bookingId}', jsonEncode(ticket.toJson()));
  }

  /// Số giờ tối thiểu trước giờ khởi hành để còn được hủy đơn đã xác nhận: `GET /policies/cancellation`.
  Future<int> getCancellationWindowHours() async {
    try {
      final res = await _api.get<Map<String, dynamic>>(ApiEndpoints.cancellationPolicy);
      final params = (res.data!['data'] as Map<String, dynamic>)['params'] as Map<String, dynamic>?;
      final hours = params?['cancellationWindowHours'];
      if (hours is num && hours >= 0) return hours.toInt();
    } catch (_) {
      // dùng mặc định của backend
    }
    return CancellationPreview.defaultWindowHours;
  }

  /// `POST /bookings/:id/cancel`. Vé đã lưu cache được đánh dấu CANCELLED để không còn dùng được offline.
  Future<BookingItem> cancelBooking(String bookingId, {String? reason}) async {
    final trimmed = reason?.trim();
    final booking = await _guard(() async {
      final res = await _api.post<Map<String, dynamic>>(
        ApiEndpoints.cancelBooking(bookingId),
        data: {if (trimmed != null && trimmed.isNotEmpty) 'reason': trimmed},
      );
      return BookingItem.fromJson(res.data!['data'] as Map<String, dynamic>);
    });
    final cached = await readCachedTicket(bookingId);
    if (cached != null) await _writeCache(cached.copyWith(status: ETicketStatus.cancelled));
    return booking;
  }

  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on DioException catch (e) {
      final body = e.response?.data;
      String? serverMessage;
      String? code;
      if (body is Map && body['error'] is Map) {
        final error = body['error'] as Map;
        if (error['message'] is String) serverMessage = error['message'] as String;
        if (error['code'] is String) code = error['code'] as String;
      }
      final status = e.response?.statusCode;
      if (status == null) {
        throw const BookingException('Không kết nối được máy chủ, kiểm tra mạng và thử lại.', offline: true);
      }
      if (code == 'CANCELLATION_WINDOW_PASSED') {
        throw const BookingException('Đã quá hạn hủy: đơn đã xác nhận chỉ được hủy trước giờ khởi hành theo chính sách.');
      }
      throw BookingException(switch (status) {
        401 => 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
        404 => 'Không tìm thấy đơn đặt chỗ hoặc vé điện tử.',
        409 => 'Đơn không thể hủy ở trạng thái hiện tại hoặc vừa thay đổi, vui lòng tải lại.',
        _ => serverMessage ?? 'Đã có lỗi xảy ra, vui lòng thử lại.',
      });
    }
  }
}
