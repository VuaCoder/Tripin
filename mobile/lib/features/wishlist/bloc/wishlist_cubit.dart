import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/app_colors.dart';
import '../../tours/models/tour_model.dart';
import '../models/recently_viewed_model.dart';
import '../models/wishlist_collection_model.dart';
import '../models/wishlist_item_model.dart';
import '../storage/wishlist_storage.dart';
import '../widgets/create_wishlist_sheet.dart';
import '../widgets/login_required_dialog.dart';
import '../widgets/save_to_wishlist_sheet.dart';
import '../widgets/saved_to_wishlist_banner.dart';
import 'wishlist_repository.dart';
import 'wishlist_state.dart';

class WishlistCubit extends Cubit<WishlistState> {
  final WishlistRepository _repository;
  final WishlistStorage _storage;

  WishlistCubit({
    WishlistRepository? repository,
    WishlistStorage? storage,
  })  : _repository = repository ?? WishlistRepository(),
        _storage = storage ?? WishlistStorage(),
        super(const WishlistState());

  /// Kiểm tra nhanh tour có trong danh sách yêu thích hay không
  bool isFavorite(String tourId) => state.isFavorite(tourId);

  /// Bật/tắt chế độ chỉnh sửa (Edit mode) ở màn hình Wishlists
  void toggleEditMode() {
    emit(state.copyWith(isEditMode: !state.isEditMode));
  }

  void setEditMode(bool isEdit) {
    emit(state.copyWith(isEditMode: isEdit));
  }

  /// Helper trích xuất danh sách ID các tour được lưu trong các collections
  Set<String> _extractSavedTourIds(List<WishlistCollectionModel> collections) {
    final ids = <String>{};
    for (final c in collections) {
      for (final t in c.tours) {
        ids.add(t.id);
      }
    }
    return ids;
  }

  /// Tải dữ liệu: Danh sách yêu thích backend + Bộ sưu tập lưu trữ cục bộ + Tour xem gần đây
  Future<void> loadWishlist() async {
    // 1. Tải dữ liệu lưu trữ cục bộ (Bộ sưu tập & Xem gần đây)
    final localCollections = await _storage.loadCollections();
    final localRecentlyViewed = await _storage.loadRecentlyViewed();

    final isAuth = await _repository.isAuthenticated();
    if (!isAuth) {
      final localIds = _extractSavedTourIds(localCollections);

      emit(state.copyWith(
        status: WishlistStatus.success,
        items: const [],
        savedTourIds: localIds,
        collections: localCollections,
        recentlyViewed: localRecentlyViewed,
        isAuthenticated: false,
      ));
      return;
    }

    emit(state.copyWith(status: WishlistStatus.loading, isAuthenticated: true));

    try {
      final items = await _repository.getWishlist();
      final ids = _extractSavedTourIds(localCollections);

      emit(state.copyWith(
        status: WishlistStatus.success,
        items: items,
        savedTourIds: ids,
        collections: localCollections,
        recentlyViewed: localRecentlyViewed,
        isAuthenticated: true,
      ));
    } catch (e) {
      final ids = _extractSavedTourIds(localCollections);
      emit(state.copyWith(
        status: WishlistStatus.failure,
        errorMessage: 'Không thể tải danh sách yêu thích. Vui lòng thử lại.',
        collections: localCollections,
        recentlyViewed: localRecentlyViewed,
        savedTourIds: ids,
        isAuthenticated: true,
      ));
    }
  }

  /// Ghi nhận tour vào mục "Recently viewed" (Xem gần đây)
  void recordRecentlyViewed(TourModel tour) {
    final now = DateTime.now();
    final updated = List<RecentlyViewedTourModel>.from(state.recentlyViewed)
      ..removeWhere((item) => item.tour.id == tour.id);

    updated.insert(
      0,
      RecentlyViewedTourModel(tour: tour, viewedAt: now),
    );

    // Giới hạn lưu tối đa 40 tour xem gần nhất
    final trimmed = updated.take(40).toList();
    emit(state.copyWith(recentlyViewed: trimmed));
    _storage.saveRecentlyViewed(trimmed);
  }

  /// Xóa tour khỏi mục "Gần đây"
  Future<void> removeRecentlyViewed(String tourId) async {
    final updated = List<RecentlyViewedTourModel>.from(state.recentlyViewed)
      ..removeWhere((item) => item.tour.id == tourId);
    emit(state.copyWith(recentlyViewed: updated));
    await _storage.saveRecentlyViewed(updated);
  }

  /// Xử lý bấm Trái tim trên thẻ tour:
  /// - Nếu tim đã đỏ rồi: Bấm 1 lần nữa sẽ remove tour khỏi danh sách,
  ///   hiển thị banner "Xoá khỏi [tên danh sách]" (không có chữ Thay đổi),
  ///   và nếu danh sách được xoá / không có danh sách nào thì bỏ hết phần tim.
  /// - Nếu chưa tạo wishlist nào: Mở sheet tạo mới (Ảnh 1)
  /// - Nếu đã có wishlist: Mở sheet chọn wishlist (Ảnh 3)
  /// - Sau khi tạo hoặc chọn: Hiện pop-up "Saved to [tên]" với nút Change (Ảnh 2)
  Future<void> handleHeartTap({
    required BuildContext context,
    required TourModel tour,
  }) async {
    final isAuth = await _repository.isAuthenticated();
    if (!isAuth) {
      if (context.mounted) {
        await LoginRequiredDialog.show(context);
      }
      return;
    }

    final isCurrentlySaved = state.isFavorite(tour.id);

    // NẾU TIM ĐÃ ĐỎ RỒI: Bấm 1 lần nữa sẽ hiện là remove:
    // Không có chữ thay đổi, và thay thành Xoá khỏi + tên danh sách,
    // Nếu danh sách được xoá / không có danh sách nào, thì bỏ hết phần tim.
    if (isCurrentlySaved) {
      final containingCols = state.collections.where((c) => c.containsTour(tour.id)).toList();
      final collectionName = containingCols.isNotEmpty ? containingCols.first.name : 'Danh sách yêu thích';

      final updatedCollections = state.collections.map((c) {
        if (c.containsTour(tour.id)) {
          return c.copyWith(
            tours: c.tours.where((t) => t.id != tour.id).toList(),
            updatedAt: DateTime.now(),
          );
        }
        return c;
      }).toList();

      final updatedSavedIds = _extractSavedTourIds(updatedCollections);

      emit(state.copyWith(
        collections: updatedCollections,
        savedTourIds: updatedSavedIds,
      ));

      await _storage.saveCollections(updatedCollections);
      _repository.removeFromWishlist(tour.id).catchError((_) {});

      if (context.mounted) {
        SavedToWishlistBanner.show(
          context,
          collectionName: collectionName,
          customMessage: 'Xoá khỏi $collectionName',
          tour: tour,
          onChangeTap: null, // Không có chữ Thay đổi
        );
      }
      return;
    }

    if (state.collections.isEmpty) {
      // Chưa có wishlist nào -> Mở bottom sheet tạo wishlist (Ảnh 1)
      if (!context.mounted) return;
      final name = await CreateWishlistSheet.show(context);
      if (name != null && name.trim().isNotEmpty && context.mounted) {
        await createCollection(name.trim(), initialTour: tour);
        if (context.mounted) {
          _showSavedBanner(context, name.trim(), tour);
        }
      }
    } else {
      // Đã có ít nhất 1 wishlist -> Mở sheet chọn wishlist (Ảnh 3)
      if (!context.mounted) return;
      await openSaveToWishlistSheet(context, tour);
    }
  }

  /// Mở modal "Save to wishlist" (Ảnh 3)
  Future<void> openSaveToWishlistSheet(BuildContext context, TourModel tour) async {
    await SaveToWishlistSheet.show(
      context: context,
      collections: state.collections,
      tour: tour,
      onSelectCollection: (collection) async {
        await addTourToCollection(collection.id, tour, context: context);
        if (context.mounted) {
          _showSavedBanner(context, collection.name, tour);
        }
      },
      onCreateNewCollection: (name) async {
        await createCollection(name, initialTour: tour);
        if (context.mounted) {
          _showSavedBanner(context, name, tour);
        }
      },
    );
  }

  /// Hiển thị banner nổi "Saved to [name]" với nút "Change" (Ảnh 2)
  void _showSavedBanner(BuildContext context, String collectionName, TourModel tour) {
    SavedToWishlistBanner.show(
      context,
      collectionName: collectionName,
      tour: tour,
      onChangeTap: () {
        openSaveToWishlistSheet(context, tour);
      },
    );
  }

  /// Tạo wishlist mới (tối đa 50 ký tự)
  Future<WishlistCollectionModel> createCollection(
    String name, {
    TourModel? initialTour,
  }) async {
    final trimmedName = name.trim();
    final now = DateTime.now();
    final newId = 'col_${now.millisecondsSinceEpoch}';

    final List<TourModel> tours = initialTour != null ? [initialTour] : [];

    final newCollection = WishlistCollectionModel(
      id: newId,
      name: trimmedName.length > 50 ? trimmedName.substring(0, 50) : trimmedName,
      tours: tours,
      createdAt: now,
      updatedAt: now,
    );

    final updatedCollections = [newCollection, ...state.collections];
    final updatedSavedIds = Set<String>.from(state.savedTourIds);
    if (initialTour != null) {
      updatedSavedIds.add(initialTour.id);
      // Gọi backend lưu tour
      _repository.addToWishlist(initialTour.id).catchError((_) {});
    }

    emit(state.copyWith(
      collections: updatedCollections,
      savedTourIds: updatedSavedIds,
      lastSavedWishlistName: newCollection.name,
      lastSavedTour: initialTour,
      hasUnseenWishlistBadge: true,
    ));

    await _storage.saveCollections(updatedCollections);
    return newCollection;
  }

  /// Đánh dấu đã xem tab wishlist để tắt chấm xanh
  void markWishlistSeen() {
    if (state.hasUnseenWishlistBadge) {
      emit(state.copyWith(hasUnseenWishlistBadge: false));
    }
  }

  /// Đổi tên danh sách wishlist (tối đa 50 ký tự)
  Future<void> renameCollection(String collectionId, String newName) async {
    final trimmed = newName.trim();
    if (trimmed.isEmpty) return;
    final finalName = trimmed.length > 50 ? trimmed.substring(0, 50) : trimmed;

    final updatedCollections = state.collections.map((c) {
      if (c.id == collectionId) {
        return c.copyWith(
          name: finalName,
          updatedAt: DateTime.now(),
        );
      }
      return c;
    }).toList();

    emit(state.copyWith(collections: updatedCollections));
    await _storage.saveCollections(updatedCollections);
  }

  /// Thêm tour vào một wishlist có sẵn
  Future<void> addTourToCollection(
    String collectionId,
    TourModel tour, {
    BuildContext? context,
  }) async {
    final updatedCollections = state.collections.map((c) {
      if (c.id == collectionId) {
        if (!c.containsTour(tour.id)) {
          return c.copyWith(
            tours: [tour, ...c.tours],
            updatedAt: DateTime.now(),
          );
        }
      }
      return c;
    }).toList();

    final updatedSavedIds = Set<String>.from(state.savedTourIds)..add(tour.id);

    final matched = state.collections.where((c) => c.id == collectionId);
    final collectionName = matched.isNotEmpty ? matched.first.name : 'Wishlist';

    emit(state.copyWith(
      collections: updatedCollections,
      savedTourIds: updatedSavedIds,
      lastSavedWishlistName: collectionName,
      lastSavedTour: tour,
      hasUnseenWishlistBadge: true,
    ));

    await _storage.saveCollections(updatedCollections);
    _repository.addToWishlist(tour.id).catchError((_) {});
  }

  /// Xóa tour khỏi một wishlist
  Future<void> removeTourFromCollection(
    String collectionId,
    String tourId, {
    BuildContext? context,
    TourModel? tour,
  }) async {
    final targetCol = state.collections.firstWhere(
      (c) => c.id == collectionId,
      orElse: () => WishlistCollectionModel(id: '', name: 'Danh sách', tours: [], createdAt: DateTime.now(), updatedAt: DateTime.now()),
    );
    final collectionName = targetCol.name;
    final resolvedTour = tour ?? targetCol.tours.cast<TourModel?>().firstWhere(
      (t) => t?.id == tourId,
      orElse: () => null,
    );

    final updatedCollections = state.collections.map((c) {
      if (c.id == collectionId) {
        final newTours = c.tours.where((t) => t.id != tourId).toList();
        return c.copyWith(
          tours: newTours,
          updatedAt: DateTime.now(),
        );
      }
      return c;
    }).toList();

    // Tính lại savedTourIds
    final updatedSavedIds = _extractSavedTourIds(updatedCollections);

    if (!updatedSavedIds.contains(tourId)) {
      _repository.removeFromWishlist(tourId).catchError((_) {});
    }

    emit(state.copyWith(
      collections: updatedCollections,
      savedTourIds: updatedSavedIds,
    ));

    await _storage.saveCollections(updatedCollections);

    if (context != null && context.mounted) {
      if (resolvedTour != null) {
        SavedToWishlistBanner.show(
          context,
          collectionName: collectionName,
          customMessage: 'Xoá khỏi $collectionName',
          tour: resolvedTour,
          onChangeTap: null, // Không có chữ Thay đổi
        );
      } else {
        _showToast(context, 'Xoá khỏi $collectionName', isSuccess: true);
      }
    }
  }

  /// Xóa một wishlist (bộ sưu tập) đã tạo
  /// Nếu danh sách được xóa hoặc không còn danh sách nào, thì bỏ hết phần tim đỏ của các tour đó
  Future<void> deleteCollection(String collectionId) async {
    final deletedCol = state.collections.firstWhere(
      (c) => c.id == collectionId,
      orElse: () => WishlistCollectionModel(id: '', name: '', tours: [], createdAt: DateTime.now(), updatedAt: DateTime.now()),
    );
    final updatedCollections = state.collections.where((c) => c.id != collectionId).toList();

    // Tính lại savedTourIds
    final remainingIds = _extractSavedTourIds(updatedCollections);

    // Xóa trên backend các tour không còn trong danh sách nào
    for (final tour in deletedCol.tours) {
      if (!remainingIds.contains(tour.id)) {
        _repository.removeFromWishlist(tour.id).catchError((_) {});
      }
    }

    // Nếu đã xóa hết tất cả custom wishlists -> Tự động thoát chế độ Edit
    final bool newEditMode = updatedCollections.isEmpty ? false : state.isEditMode;

    emit(state.copyWith(
      collections: updatedCollections,
      savedTourIds: remainingIds,
      isEditMode: newEditMode,
    ));

    await _storage.saveCollections(updatedCollections);
  }

  /// Tương thích ngược với các thành phần cũ
  Future<bool> toggleFavorite({
    required TourModel tour,
    required BuildContext context,
  }) async {
    await handleHeartTap(context: context, tour: tour);
    return isFavorite(tour.id);
  }

  /// Xóa nhanh tour khỏi danh sách (tương thích backward)
  Future<bool> removeItem(String tourId, {BuildContext? context}) async {
    final previousIds = Set<String>.from(state.savedTourIds);
    final previousItems = List<WishlistItemModel>.from(state.items);

    final newIds = Set<String>.from(previousIds)..remove(tourId);
    final newItems = previousItems.where((item) => item.tourId != tourId).toList();

    emit(state.copyWith(savedTourIds: newIds, items: newItems));

    if (context != null && context.mounted) {
      _showToast(context, 'Đã xóa tour khỏi danh sách yêu thích', isSuccess: true);
    }

    try {
      await _repository.removeFromWishlist(tourId);
      return true;
    } catch (_) {
      emit(state.copyWith(savedTourIds: previousIds, items: previousItems));
      return false;
    }
  }

  void _showToast(BuildContext context, String message, {bool isSuccess = true}) {
    try {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                isSuccess ? Icons.favorite_rounded : Icons.error_outline_rounded,
                color: Colors.white,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          backgroundColor: isSuccess ? AppColors.textPrimary : AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 2),
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      );
    } catch (_) {}
  }

  /// Reset dữ liệu wishlist khi người dùng đăng xuất
  void clear() {
    emit(const WishlistState(isAuthenticated: false));
  }
}
