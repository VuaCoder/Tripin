import 'package:shared_preferences/shared_preferences.dart';

/// Quản lý lịch sử tìm kiếm gần nhất cục bộ bằng SharedPreferences (AC5)
class SearchHistoryStorage {
  static const String _keyRecentSearches = 'tripri_recent_searches';
  static const int _maxHistoryItems = 10;

  final SharedPreferences? prefs;

  SearchHistoryStorage({this.prefs});

  Future<SharedPreferences> get _instance async =>
      prefs ?? await SharedPreferences.getInstance();

  /// Lấy danh sách từ khóa tìm kiếm gần đây nhất (tối đa 10 mục)
  Future<List<String>> getRecentSearches() async {
    final prefs = await _instance;
    return prefs.getStringList(_keyRecentSearches) ?? [];
  }

  /// Thêm từ khóa vào danh sách tìm kiếm gần đây
  Future<void> addSearch(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    final prefs = await _instance;
    final currentList = prefs.getStringList(_keyRecentSearches) ?? [];

    // Loại bỏ từ khóa trùng lặp (không phân biệt chữ hoa/thường)
    final updatedList = currentList
        .where((item) => item.toLowerCase() != trimmed.toLowerCase())
        .toList();

    // Chèn từ khóa mới nhất vào đầu danh sách
    updatedList.insert(0, trimmed);

    // Giới hạn tối đa 10 mục
    if (updatedList.length > _maxHistoryItems) {
      updatedList.removeRange(_maxHistoryItems, updatedList.length);
    }

    await prefs.setStringList(_keyRecentSearches, updatedList);
  }

  /// Xóa một từ khóa cụ thể khỏi lịch sử
  Future<void> removeSearch(String query) async {
    final prefs = await _instance;
    final currentList = prefs.getStringList(_keyRecentSearches) ?? [];
    currentList.removeWhere((item) => item.toLowerCase() == query.trim().toLowerCase());
    await prefs.setStringList(_keyRecentSearches, currentList);
  }

  /// Xóa toàn bộ lịch sử tìm kiếm
  Future<void> clearAll() async {
    final prefs = await _instance;
    await prefs.remove(_keyRecentSearches);
  }
}
