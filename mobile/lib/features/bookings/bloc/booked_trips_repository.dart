import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../models/booking_models.dart';
import 'bookings_repository.dart';

class BookedTripsRepository {
  static const _storageKey = 'tripri_booked_trips_v2';
  static const _reviewedStorageKey = 'tripri_reviewed_bookings';
  static final ValueNotifier<int> statsNotifier = ValueNotifier<int>(0);
  final BookingsRepository _remoteRepo;

  BookedTripsRepository({BookingsRepository? remoteRepo}) : _remoteRepo = remoteRepo ?? BookingsRepository();

  /// Lấy danh sách ID các đơn đặt tour đã được người dùng đánh giá
  Future<Set<String>> getReviewedBookingIds() async {
    final prefs = await SharedPreferences.getInstance();
    final localList = prefs.getStringList(_reviewedStorageKey) ?? <String>[];
    final reviewedSet = localList.toSet();

    try {
      final token = await TokenStorage().getAccessToken();
      if (token != null && token.isNotEmpty) {
        final client = ApiClient();
        final res = await client.get(ApiEndpoints.myReviews);
        final dynamic raw = res.data;
        List<dynamic> list = [];
        if (raw is Map<String, dynamic> && raw['data'] is List) {
          list = raw['data'] as List<dynamic>;
        } else if (raw is List) {
          list = raw;
        }
        for (final item in list) {
          if (item is Map<String, dynamic>) {
            final bId = item['bookingId'] as String?;
            if (bId != null && bId.isNotEmpty) {
              reviewedSet.add(bId);
            }
          }
        }
        await prefs.setStringList(_reviewedStorageKey, reviewedSet.toList());
      }
    } catch (e) {
      debugPrint('[BookedTripsRepository] fetch reviews/me skipped: $e');
    }
    return reviewedSet;
  }

  /// Lấy danh sách chuyến đi đã đặt (Ưu tiên cache cục bộ + đồng bộ máy chủ nếu có mạng)
  Future<List<BookingItem>> getTrips() async {
    final reviewedIds = await getReviewedBookingIds();
    final local = await getLocalTrips();

    // Cập nhật cờ isReviewed dựa trên danh sách đánh giá
    final localWithReviews = local.map((t) {
      final isRev = t.isReviewed || reviewedIds.contains(t.id) || reviewedIds.contains(t.bookingCode);
      return isRev != t.isReviewed ? t.copyWith(isReviewed: isRev) : t;
    }).toList();

    try {
      final remote = await _remoteRepo.listMine(limit: 20);
      if (remote.items.isNotEmpty) {
        final existingIds = localWithReviews.map((e) => e.id).toSet();
        final merged = List<BookingItem>.from(localWithReviews);
        for (final r in remote.items) {
          // Bỏ qua nếu là dữ liệu demo Dalat
          if (r.id == 'trip-dalat-demo-1' || r.bookingCode == 'TRP-DLT8920' || r.tourTitle == 'Dalat') {
            continue;
          }
          final isRev = r.isReviewed || reviewedIds.contains(r.id) || reviewedIds.contains(r.bookingCode);
          final updatedR = r.copyWith(isReviewed: isRev);
          if (!existingIds.contains(r.id)) {
            merged.add(updatedR);
          } else {
            final idx = merged.indexWhere((e) => e.id == r.id);
            if (idx != -1) {
              merged[idx] = updatedR.copyWith(
                status: merged[idx].status == BookingStatus.completed ? BookingStatus.completed : updatedR.status,
                isReviewed: merged[idx].isReviewed || isRev,
              );
            }
          }
        }
        await _saveList(merged);
        return merged;
      }
    } catch (err) {
      debugPrint('[BookedTripsRepository] remote sync skipped: $err');
    }
    return localWithReviews;
  }

  /// Lấy từ local storage (Đã loại bỏ hoàn toàn dữ liệu demo Da Lat)
  Future<List<BookingItem>> getLocalTrips() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final list = jsonDecode(raw) as List;
        final trips = list
            .map((e) => BookingItem.fromJson(e as Map<String, dynamic>))
            // Dọn sạch mục demo cũ Dalat
            .where((t) => t.id != 'trip-dalat-demo-1' && t.bookingCode != 'TRP-DLT8920' && t.tourTitle != 'Dalat')
            .toList();
        return trips;
      }
    } catch (e) {
      debugPrint('[BookedTripsRepository] read error: $e');
    }
    return [];
  }

  /// Lưu đơn đặt tour mới vào danh sách chuyến đi
  Future<void> saveTrip(BookingItem item) async {
    try {
      final current = await getLocalTrips();
      // Loại bỏ trùng id nếu có
      final updated = [item, ...current.where((e) => e.id != item.id && e.bookingCode != item.bookingCode)];
      await _saveList(updated);
    } catch (e) {
      debugPrint('[BookedTripsRepository] saveTrip error: $e');
    }
  }

  /// Đánh dấu chuyến đi đã hoàn thành (Người dùng chỉ được đánh giá sau khi hoàn thành)
  Future<void> markCompleted(String bookingId) async {
    try {
      final current = await getLocalTrips();
      final updated = current.map((item) {
        if (item.id == bookingId || item.bookingCode == bookingId) {
          return item.copyWith(status: BookingStatus.completed);
        }
        return item;
      }).toList();
      await _saveList(updated);

      // Đồng bộ phía máy chủ nếu đơn là UUID hợp lệ
      if (RegExp(r'^[0-9a-fA-F-]{36}$').hasMatch(bookingId)) {
        try {
          final api = ApiClient();
          await api.post(ApiEndpoints.completeBooking(bookingId));
        } catch (e) {
          debugPrint('[BookedTripsRepository] remote complete error: $e');
        }
      }
    } catch (e) {
      debugPrint('[BookedTripsRepository] markCompleted error: $e');
    }
  }

  /// Đánh dấu chuyến đi đã được gửi đánh giá thành công
  Future<void> markReviewed(String bookingId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final localList = prefs.getStringList(_reviewedStorageKey) ?? <String>[];
      final reviewedSet = localList.toSet();
      reviewedSet.add(bookingId);
      await prefs.setStringList(_reviewedStorageKey, reviewedSet.toList());

      final current = await getLocalTrips();
      final updated = current.map((item) {
        if (item.id == bookingId || item.bookingCode == bookingId) {
          return item.copyWith(isReviewed: true);
        }
        return item;
      }).toList();
      await _saveList(updated);
      statsNotifier.value++;
    } catch (e) {
      debugPrint('[BookedTripsRepository] markReviewed error: $e');
    }
  }

  Future<void> _saveList(List<BookingItem> items) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = jsonEncode(items.map((e) => e.toJson()).toList());
      await prefs.setString(_storageKey, jsonStr);
      statsNotifier.value++;
    } catch (e) {
      debugPrint('[BookedTripsRepository] saveList error: $e');
    }
  }
}
