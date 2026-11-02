import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/recently_viewed_model.dart';
import '../models/wishlist_collection_model.dart';

/// Lớp quản lý lưu trữ cục bộ các bộ sưu tập Wishlist và lịch sử Xem gần đây
/// Hỗ trợ cơ chế Audit Log bền vững: ghi nhớ vĩnh viễn các tour người dùng đã xem,
/// kể cả khi người dùng bấm xoá lịch sử vẫn lưu lại để hiển thị đầy đủ!
class WishlistStorage {
  static const String _keyCollections = 'user_wishlist_collections_v1';
  static const String _keyRecentlyViewed = 'user_recently_viewed_tours_v1';
  static const String _keyAuditLog = 'user_audit_log_viewed_tours_v1';

  final SharedPreferences? prefs;

  WishlistStorage({this.prefs});

  Future<SharedPreferences> _getPrefs() async {
    return prefs ?? await SharedPreferences.getInstance();
  }

  String _colKey(String? userId) =>
      (userId != null && userId.isNotEmpty) ? 'wishlist_collections_uid_$userId' : _keyCollections;

  String _recentKey(String? userId) =>
      (userId != null && userId.isNotEmpty) ? 'recently_viewed_uid_$userId' : _keyRecentlyViewed;

  String _auditKey(String? userId) =>
      (userId != null && userId.isNotEmpty) ? 'audit_log_viewed_tours_uid_$userId' : _keyAuditLog;

  /// Tải danh sách bộ sưu tập đã tạo (ưu tiên theo userId, fallback sang toàn cục)
  Future<List<WishlistCollectionModel>> loadCollections({String? userId}) async {
    try {
      final p = await _getPrefs();
      List<String>? raw;
      if (userId != null && userId.isNotEmpty) {
        raw = p.getStringList(_colKey(userId));
      }
      // Fallback sang kho toàn cục nếu kho theo user chưa có
      raw ??= p.getStringList(_keyCollections);

      if (raw == null || raw.isEmpty) return [];

      return raw
          .map((item) => WishlistCollectionModel.fromJson(jsonDecode(item) as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Lưu danh sách bộ sưu tập (lưu cả kho theo user và kho toàn cục)
  Future<void> saveCollections(List<WishlistCollectionModel> collections, {String? userId}) async {
    try {
      final p = await _getPrefs();
      final raw = collections.map((c) => jsonEncode(c.toJson())).toList();
      await p.setStringList(_keyCollections, raw);
      if (userId != null && userId.isNotEmpty) {
        await p.setStringList(_colKey(userId), raw);
      }
    } catch (_) {}
  }

  /// Ghi nhận tour vào Audit Log (Lưu trữ vĩnh viễn theo cơ chế audit log)
  Future<void> recordToAuditLog(List<RecentlyViewedTourModel> items, {String? userId}) async {
    try {
      final p = await _getPrefs();
      final key = _auditKey(userId);
      final existingRaw = p.getStringList(key) ?? p.getStringList(_keyAuditLog) ?? [];
      final existing = existingRaw
          .map((e) => RecentlyViewedTourModel.fromJson(jsonDecode(e) as Map<String, dynamic>))
          .toList();

      final map = <String, RecentlyViewedTourModel>{};
      for (final item in items) {
        map[item.tour.id] = item;
      }
      for (final item in existing) {
        map.putIfAbsent(item.tour.id, () => item);
      }
      final merged = map.values.toList();
      final raw = merged.map((i) => jsonEncode(i.toJson())).toList();
      await p.setStringList(key, raw);
      await p.setStringList(_keyAuditLog, raw);
    } catch (_) {}
  }

  /// Tải toàn bộ danh sách tour từ Audit Log
  Future<List<RecentlyViewedTourModel>> loadAuditLog({String? userId}) async {
    try {
      final p = await _getPrefs();
      List<String>? raw;
      if (userId != null && userId.isNotEmpty) {
        raw = p.getStringList(_auditKey(userId));
      }
      raw ??= p.getStringList(_keyAuditLog);
      if (raw == null || raw.isEmpty) return [];

      return raw
          .map((item) => RecentlyViewedTourModel.fromJson(jsonDecode(item) as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Tải danh sách các tour xem gần đây (ưu tiên theo userId, tự động fallback sang Audit Log)
  Future<List<RecentlyViewedTourModel>> loadRecentlyViewed({String? userId}) async {
    try {
      final p = await _getPrefs();
      List<String>? raw;
      if (userId != null && userId.isNotEmpty) {
        raw = p.getStringList(_recentKey(userId));
      }
      raw ??= p.getStringList(_keyRecentlyViewed);

      if (raw != null && raw.isNotEmpty) {
        final items = raw
            .map((item) => RecentlyViewedTourModel.fromJson(jsonDecode(item) as Map<String, dynamic>))
            .toList();
        if (items.isNotEmpty) return items;
      }

      // Nếu danh sách active trống (ví dụ người dùng xoá lịch sử), tự động phục hồi từ Audit Log để luôn có tour hiển thị
      return await loadAuditLog(userId: userId);
    } catch (_) {
      return [];
    }
  }

  /// Lưu danh sách các tour xem gần đây
  Future<void> saveRecentlyViewed(List<RecentlyViewedTourModel> items, {String? userId}) async {
    try {
      final p = await _getPrefs();
      final raw = items.map((i) => jsonEncode(i.toJson())).toList();
      await p.setStringList(_keyRecentlyViewed, raw);
      if (userId != null && userId.isNotEmpty) {
        await p.setStringList(_recentKey(userId), raw);
      }
      // Đồng thời đồng bộ vào Audit Log vĩnh viễn
      if (items.isNotEmpty) {
        await recordToAuditLog(items, userId: userId);
      }
    } catch (_) {}
  }

  /// Không xóa vĩnh viễn dữ liệu người dùng khi logout để giữ nguyên yêu thích khi đăng nhập lại
  Future<void> clearAll() async {
    // Giữ nguyên dữ liệu để khi người dùng đăng nhập lại không bị reset!
  }
}
