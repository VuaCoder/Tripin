import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/booking_models.dart';
import 'bookings_repository.dart';

class BookedTripsRepository {
  static const _storageKey = 'tripri_booked_trips_v2';
  final BookingsRepository _remoteRepo;

  BookedTripsRepository({BookingsRepository? remoteRepo}) : _remoteRepo = remoteRepo ?? BookingsRepository();

  /// Lấy danh sách chuyến đi đã đặt (Ưu tiên cache cục bộ + seed mẫu + đồng bộ máy chủ nếu có mạng)
  Future<List<BookingItem>> getTrips() async {
    final local = await getLocalTrips();
    try {
      final remote = await _remoteRepo.listMine(limit: 20);
      if (remote.items.isNotEmpty) {
        final existingIds = local.map((e) => e.id).toSet();
        final merged = List<BookingItem>.from(local);
        for (final r in remote.items) {
          if (!existingIds.contains(r.id)) {
            merged.add(r);
          }
        }
        await _saveList(merged);
        return merged;
      }
    } catch (err) {
      debugPrint('[BookedTripsRepository] remote sync skipped: $err');
    }
    return local;
  }

  /// Lấy từ local storage
  Future<List<BookingItem>> getLocalTrips() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final list = jsonDecode(raw) as List;
        return list.map((e) => BookingItem.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (e) {
      debugPrint('[BookedTripsRepository] read error: $e');
    }

    // Mẫu mặc định chuyến đi Dalat giống Ảnh 3
    final defaultTrips = [
      BookingItem(
        id: 'trip-dalat-demo-1',
        bookingCode: 'TRP-DLT8920',
        status: BookingStatus.confirmed,
        tourId: 'tour-dalat-1',
        tourTitle: 'Dalat',
        departureDate: DateTime(2026, 8, 18),
        endDate: DateTime(2026, 8, 20),
        participants: 4, // 1 người đặt (H) + 3 người đi cùng (+3)
        totalAmount: 3200000,
        isPaid: true,
        refundRequired: false,
        thumbnailUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600&auto=format&fit=crop&q=80',
        destination: 'Dalat',
        contactName: 'Hoàng Phúc',
      ),
    ];
    await _saveList(defaultTrips);
    return defaultTrips;
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
      final current = await getLocalTrips();
      final updated = current.map((item) {
        if (item.id == bookingId || item.bookingCode == bookingId) {
          return item.copyWith(isReviewed: true);
        }
        return item;
      }).toList();
      await _saveList(updated);
    } catch (e) {
      debugPrint('[BookedTripsRepository] markReviewed error: $e');
    }
  }

  Future<void> _saveList(List<BookingItem> items) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = jsonEncode(items.map((e) => e.toJson()).toList());
      await prefs.setString(_storageKey, jsonStr);
    } catch (e) {
      debugPrint('[BookedTripsRepository] saveList error: $e');
    }
  }
}
