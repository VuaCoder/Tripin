import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/recently_viewed_model.dart';
import '../models/wishlist_collection_model.dart';

/// Lớp quản lý lưu trữ cục bộ các bộ sưu tập Wishlist và lịch sử Xem gần đây
class WishlistStorage {
  static const String _keyCollections = 'user_wishlist_collections_v1';
  static const String _keyRecentlyViewed = 'user_recently_viewed_tours_v1';

  final SharedPreferences? prefs;

  WishlistStorage({this.prefs});

  Future<SharedPreferences> _getPrefs() async {
    return prefs ?? await SharedPreferences.getInstance();
  }

  /// Tải danh sách bộ sưu tập đã tạo
  Future<List<WishlistCollectionModel>> loadCollections() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getStringList(_keyCollections);
      if (raw == null || raw.isEmpty) return [];

      return raw
          .map((item) => WishlistCollectionModel.fromJson(jsonDecode(item) as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Lưu danh sách bộ sưu tập
  Future<void> saveCollections(List<WishlistCollectionModel> collections) async {
    try {
      final prefs = await _getPrefs();
      final raw = collections.map((c) => jsonEncode(c.toJson())).toList();
      await prefs.setStringList(_keyCollections, raw);
    } catch (_) {}
  }

  /// Tải danh sách các tour xem gần đây
  Future<List<RecentlyViewedTourModel>> loadRecentlyViewed() async {
    try {
      final prefs = await _getPrefs();
      final raw = prefs.getStringList(_keyRecentlyViewed);
      if (raw == null || raw.isEmpty) return [];

      return raw
          .map((item) => RecentlyViewedTourModel.fromJson(jsonDecode(item) as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Lưu danh sách các tour xem gần đây
  Future<void> saveRecentlyViewed(List<RecentlyViewedTourModel> items) async {
    try {
      final prefs = await _getPrefs();
      final raw = items.map((i) => jsonEncode(i.toJson())).toList();
      await prefs.setStringList(_keyRecentlyViewed, raw);
    } catch (_) {}
  }

  /// Xóa toàn bộ dữ liệu lưu trữ (khi đăng xuất)
  Future<void> clearAll() async {
    try {
      final prefs = await _getPrefs();
      await prefs.remove(_keyCollections);
      await prefs.remove(_keyRecentlyViewed);
    } catch (_) {}
  }
}
