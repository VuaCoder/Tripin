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
    this.isEditMode = false,
    this.hasUnseenWishlistBadge = false,
    this.lastSavedWishlistName,
    this.lastSavedTour,
    this.errorMessage,
    this.isAuthenticated = true,
  });

  /// Kiểm tra xem tour đã được lưu (yêu thích) hay chưa
  /// Nếu không có danh sách nào hoặc danh sách bị xoá hết thì không có tim đỏ
  bool isFavorite(String tourId) {
    if (collections.isEmpty) return false;
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
      isEditMode: isEditMode ?? this.isEditMode,
      hasUnseenWishlistBadge: hasUnseenWishlistBadge ?? this.hasUnseenWishlistBadge,
      lastSavedWishlistName: lastSavedWishlistName ?? this.lastSavedWishlistName,
      lastSavedTour: lastSavedTour ?? this.lastSavedTour,
      errorMessage: errorMessage,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }
}
