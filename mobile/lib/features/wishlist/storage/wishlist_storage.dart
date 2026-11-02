import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/recently_viewed_model.dart';
import '../models/wishlist_collection_model.dart';

/// Lớp quản lý lưu trữ cục bộ các bộ sưu tập Wishlist và lịch sử Xem gần đây
/// Hỗ trợ lưu trữ bền vững theo User ID để khi đăng nhập lại không bao giờ bị mất!
class WishlistStorage {
  static const String _keyCollections = 'user_wishlist_collections_v1';
  static const String _keyRecentlyViewed = 'user_recently_viewed_tours_v1';

  final SharedPreferences? prefs;

  WishlistStorage({this.prefs});

  Future<SharedPreferences> _getPrefs() async {
    return prefs ?? await SharedPreferences.getInstance();
  }

  String _colKey(String? userId) =>
      (userId != null && userId.isNotEmpty) ? 'wishlist_collections_uid_$userId' : _keyCollections;

  String _recentKey(String? userId) =>
      (userId != null && userId.isNotEmpty) ? 'recently_viewed_uid_$userId' : _keyRecentlyViewed;

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

  /// Tải danh sách các tour xem gần đây (ưu tiên theo userId, fallback sang toàn cục)
  Future<List<RecentlyViewedTourModel>> loadRecentlyViewed({String? userId}) async {
    try {
      final p = await _getPrefs();
      List<String>? raw;
      if (userId != null && userId.isNotEmpty) {
        raw = p.getStringList(_recentKey(userId));
      }
      raw ??= p.getStringList(_keyRecentlyViewed);

      if (raw == null || raw.isEmpty) return [];

      return raw
          .map((item) => RecentlyViewedTourModel.fromJson(jsonDecode(item) as Map<String, dynamic>))
          .toList();
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
    } catch (_) {}
  }

  /// Không xóa vĩnh viễn dữ liệu người dùng khi logout để giữ nguyên yêu thích khi đăng nhập lại
  Future<void> clearAll() async {
    // Giữ nguyên dữ liệu để khi người dùng đăng nhập lại không bị reset!
  }
}
