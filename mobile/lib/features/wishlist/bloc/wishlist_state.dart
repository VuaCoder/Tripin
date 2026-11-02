import '../../tours/models/tour_model.dart';
import '../models/recently_viewed_model.dart';
import '../models/wishlist_collection_model.dart';
import '../models/wishlist_item_model.dart';

enum WishlistStatus { initial, loading, success, failure }

class WishlistState {
  final WishlistStatus status;
  final List<WishlistItemModel> items;
  final Set<String> savedTourIds;
  final List<WishlistCollectionModel> collections;
  final List<RecentlyViewedTourModel> recentlyViewed;
  final List<RecentlyViewedTourModel> auditLog;
  final bool isEditMode;
  final bool hasUnseenWishlistBadge;
  final String? lastSavedWishlistName;
  final TourModel? lastSavedTour;
  final String? errorMessage;
  final bool isAuthenticated;

  const WishlistState({
    this.status = WishlistStatus.initial,
    this.items = const [],
    this.savedTourIds = const {},
    this.collections = const [],
    this.recentlyViewed = const [],
    this.auditLog = const [],
    this.isEditMode = false,
    this.hasUnseenWishlistBadge = false,
    this.lastSavedWishlistName,
    this.lastSavedTour,
    this.errorMessage,
    this.isAuthenticated = true,
  });

  /// Danh sách tour xem gần đây hiệu dụng:
  /// Ưu tiên recentlyViewed, nếu người dùng đã xoá hiển thị thì tự động lấy từ Audit Log
  /// để luôn lưu giữ và hiển thị các tour đã xem trong ứng dụng!
  List<RecentlyViewedTourModel> get effectiveRecentlyViewed =>
      recentlyViewed.isNotEmpty ? recentlyViewed : auditLog;

  /// Kiểm tra xem tour đã được lưu (yêu thích) hay chưa
  /// Kiểm tra đồng bộ qua tập hợp ID đã lưu, qua danh sách backend hoặc qua các bộ sưu tập
  bool isFavorite(String tourId) {
    if (savedTourIds.contains(tourId)) return true;
    if (items.any((item) => item.tourId == tourId)) return true;
    for (final col in collections) {
      if (col.containsTour(tourId)) return true;
    }
    return false;
  }

  /// Có danh sách yêu thích tự tạo hay không (để hiển thị nút Edit)
  bool get hasCustomWishlists => collections.isNotEmpty;

  WishlistState copyWith({
    WishlistStatus? status,
    List<WishlistItemModel>? items,
    Set<String>? savedTourIds,
    List<WishlistCollectionModel>? collections,
    List<RecentlyViewedTourModel>? recentlyViewed,
    List<RecentlyViewedTourModel>? auditLog,
    bool? isEditMode,
    bool? hasUnseenWishlistBadge,
    String? lastSavedWishlistName,
    TourModel? lastSavedTour,
    String? errorMessage,
    bool? isAuthenticated,
  }) {
    return WishlistState(
      status: status ?? this.status,
      items: items ?? this.items,
      savedTourIds: savedTourIds ?? this.savedTourIds,
      collections: collections ?? this.collections,
      recentlyViewed: recentlyViewed ?? this.recentlyViewed,
      auditLog: auditLog ?? this.auditLog,
      isEditMode: isEditMode ?? this.isEditMode,
      hasUnseenWishlistBadge: hasUnseenWishlistBadge ?? this.hasUnseenWishlistBadge,
      lastSavedWishlistName: lastSavedWishlistName ?? this.lastSavedWishlistName,
      lastSavedTour: lastSavedTour ?? this.lastSavedTour,
      errorMessage: errorMessage,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }
}
