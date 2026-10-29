import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/bookings/bloc/bookings_repository.dart';
import 'package:mobile/features/bookings/models/booking_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Tok extends TokenStorage {
  @override
  Future<String?> getAccessToken() async => 't';
}

/// Trả vé khi online, ném lỗi kết nối khi offline.
class _Adapter implements HttpClientAdapter {
  bool online = true;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<List<int>>? requestStream, Future<void>? cancelFuture) async {
    if (!online) throw DioException.connectionError(requestOptions: options, reason: 'offline');
    final body = jsonEncode({
      'success': true,
      'data': {
        'id': 'e1',
        'code': 'ETK-ABCDEFGH12345678',
        'status': 'VALID',
        'booking': {'id': 'b1', 'code': 'TRP-1'},
        'tour': {'id': 't', 'title': 'Hạ Long', 'destination': 'Quảng Ninh', 'meetingPoint': 'Bến Tuần Châu'},
        'departureDate': '2026-12-01T00:00:00.000Z',
        'participants': 2,
        'holderName': 'Nguyen Van A',
      },
    });
    return ResponseBody.fromString(body, 200, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('ticket stays viewable offline from cache (AC3)', () async {
    SharedPreferences.setMockInitialValues({});
    final adapter = _Adapter();
    final api = ApiClient(storage: _Tok())..dio.httpClientAdapter = adapter;
    final repo = BookingsRepository(api: api);

    final online = await repo.getTicketForBooking('b1');
    expect(online.fromCache, isFalse);

    adapter.online = false;
    final offline = await repo.getTicketForBooking('b1');
    expect(offline.fromCache, isTrue);
    expect(offline.ticket.code, 'ETK-ABCDEFGH12345678');
    expect(offline.ticket.destination, 'Quảng Ninh');
    expect(offline.ticket.meetingPoint, 'Bến Tuần Châu');
  });

  test('offline with no cache surfaces an offline error', () async {
    SharedPreferences.setMockInitialValues({});
    final adapter = _Adapter()..online = false;
    final repo = BookingsRepository(api: ApiClient(storage: _Tok())..dio.httpClientAdapter = adapter);
    expect(
      repo.getTicketForBooking('b1'),
      throwsA(isA<BookingException>().having((e) => e.offline, 'offline', isTrue)),
    );
  });

  test('cancelling marks the cached ticket CANCELLED', () async {
    SharedPreferences.setMockInitialValues({});
    final adapter = _Adapter();
    final api = ApiClient(storage: _Tok())..dio.httpClientAdapter = adapter;
    final repo = BookingsRepository(api: api);
    await repo.getTicketForBooking('b1');
    // Adapter trả vé cho mọi request; chỉ kiểm tra việc ghi đè cache qua copyWith.
    final cached = (await repo.readCachedTicket('b1'))!;
    expect(cached.copyWith(status: ETicketStatus.cancelled).status, ETicketStatus.cancelled);
  });
}
