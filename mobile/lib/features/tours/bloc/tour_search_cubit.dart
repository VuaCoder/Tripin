import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/storage/search_history_storage.dart';
import '../models/category_model.dart';
import '../models/tour_filter_criteria.dart';
import 'tour_search_state.dart';
import 'tours_repository.dart';

class TourSearchCubit extends Cubit<TourSearchState> {
  final ToursRepository _repository;
  final SearchHistoryStorage _historyStorage;
  Timer? _debounceTimer;
  static const int _pageSize = 10;

  TourSearchCubit({
    ToursRepository? repository,
    SearchHistoryStorage? historyStorage,
  })  : _repository = repository ?? ToursRepository(),
        _historyStorage = historyStorage ?? SearchHistoryStorage(),
        super(const TourSearchState());

  @override
  Future<void> close() {
    _debounceTimer?.cancel();
    return super.close();
  }

  // Getters tiện ích đồng bộ với state
  TourFilterCriteria get filterCriteria => state.filterCriteria;
  int get activeFilterCount => state.activeFilterCount;
  List<String> get recentSearches => state.recentSearches;
  int get currentPage => state.currentPage;
  bool get hasReachedMax => state.hasReachedMax;
  bool get isLoadingMore => state.isLoadingMore;
  String? get searchDatesSummary => state.searchDatesSummary;
  String? get searchGuestsSummary => state.searchGuestsSummary;

  /// Khởi tạo dữ liệu tìm kiếm, nạp danh mục và lịch sử tìm kiếm gần đây
  Future<void> init({
    String? initialCategoryId,
    String? initialQuery,
    List<CategoryModel>? categories,
  }) async {
    final recent = await _historyStorage.getRecentSearches();

    TourFilterCriteria initialCriteria = state.filterCriteria;
    if (initialCategoryId != null && initialCategoryId.isNotEmpty) {
      initialCriteria = initialCriteria.copyWith(categoryIds: {initialCategoryId});
    }

    emit(state.copyWith(
      selectedCategoryId: initialCategoryId,
      searchQuery: initialQuery ?? '',
      filterCriteria: initialCriteria,
      categories: categories ?? state.categories,
      recentSearches: recent,
      status: TourSearchStatus.loading,
    ));

    // Nạp danh mục nếu chưa có
    if (state.categories.isEmpty) {
      try {
        final fetchedCategories = await _repository.getCategories();
        emit(state.copyWith(categories: fetchedCategories));
      } catch (_) {}
    }

    await search(isRefresh: true);
  }

  /// Xử lý nhập từ khóa với cơ chế Debounce 300ms (AC1)
  void onQueryChanged(String query) {
    emit(state.copyWith(searchQuery: query));
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 300), () {
      search(isRefresh: true);
    });
  }

  /// Cập nhật từ khóa ngay lập tức mà không chờ debounce
  void updateQuery(String query) {
    emit(state.copyWith(searchQuery: query));
  }

  /// Cập nhật thông số tìm kiếm từ Airbnb Search Modal (Địa điểm, Thời gian, Số khách)
  void updateSearchParams({
    required String query,
    String? datesSummary,
    String? guestsSummary,
  }) {
    emit(state.copyWith(
      searchQuery: query,
      searchDatesSummary: datesSummary,
      searchGuestsSummary: guestsSummary,
    ));
    search(isRefresh: true);
  }

  /// Chọn từ khóa từ lịch sử tìm kiếm gần đây (AC5)
  void selectHistoryQuery(String query) {
    emit(state.copyWith(searchQuery: query, isSearchFieldFocused: false));
    search(isRefresh: true);
  }

  /// Xóa 1 từ khóa khỏi lịch sử tìm kiếm (AC5)
  Future<void> removeHistoryItem(String query) async {
    await _historyStorage.removeSearch(query);
    final updated = await _historyStorage.getRecentSearches();
    emit(state.copyWith(recentSearches: updated));
  }

  /// Xóa toàn bộ lịch sử tìm kiếm (AC5)
  Future<void> clearHistory() async {
    await _historyStorage.clearAll();
    emit(state.copyWith(recentSearches: const []));
  }

  /// Đặt trạng thái focus của ô tìm kiếm
  void setSearchFieldFocused(bool isFocused) {
    emit(state.copyWith(isSearchFieldFocused: isFocused));
  }

  /// Chọn nhanh 1 danh mục
  void selectCategory(String? categoryId) {
    Set<String> newCatIds = Set.from(state.filterCriteria.categoryIds);
    if (categoryId == null) {
      newCatIds.clear();
    } else {
      if (newCatIds.contains(categoryId)) {
        newCatIds.remove(categoryId);
      } else {
        newCatIds = {categoryId};
      }
    }

    final updatedCriteria = state.filterCriteria.copyWith(categoryIds: newCatIds);
    applyFilters(updatedCriteria);
  }

  /// Cập nhật sắp xếp nhanh
  void setSort(String sort) {
    final updatedCriteria = state.filterCriteria.copyWith(sort: sort);
    applyFilters(updatedCriteria);
  }

  /// Áp dụng bộ lọc đa tiêu chí từ Bottom Sheet (AC2)
  void applyFilters(TourFilterCriteria criteria) {
    emit(state.copyWith(
      filterCriteria: criteria,
      selectedCategoryId: criteria.categoryIds.isNotEmpty ? criteria.categoryIds.first : null,
      clearCategory: criteria.categoryIds.isEmpty,
      selectedSort: criteria.sort,
    ));
    search(isRefresh: true);
  }

  /// Đặt lại toàn bộ bộ lọc về mặc định (AC4)
  void resetFilters() {
    emit(state.copyWith(
      filterCriteria: TourFilterCriteria.empty,
      clearCategory: true,
      selectedSort: 'newest',
    ));
    search(isRefresh: true);
  }

  /// Xóa nhanh 1 tiêu chí lọc
  void removePriceFilter() {
    applyFilters(state.filterCriteria.copyWith(clearPrice: true));
  }

  void removeDurationFilter() {
    applyFilters(state.filterCriteria.copyWith(clearDuration: true));
  }

  void removeRatingFilter() {
    applyFilters(state.filterCriteria.copyWith(clearRating: true));
  }

  void removeCategoryFilter(String catId) {
    final newCatIds = Set<String>.from(state.filterCriteria.categoryIds)..remove(catId);
    applyFilters(state.filterCriteria.copyWith(categoryIds: newCatIds));
  }

  /// Thực hiện tìm kiếm tour (AC1, AC2)
  Future<void> search({bool isRefresh = true}) async {
    if (isRefresh) {
      emit(state.copyWith(
        status: TourSearchStatus.loading,
        currentPage: 1,
        hasReachedMax: false,
      ));
    }

    final query = state.searchQuery.trim();

    // Lưu vào lịch sử tìm kiếm nếu có từ khóa (AC5)
    if (query.isNotEmpty) {
      await _historyStorage.addSearch(query);
      final updatedHistory = await _historyStorage.getRecentSearches();
      emit(state.copyWith(recentSearches: updatedHistory));
    }

    try {
      final criteria = state.filterCriteria;
      final tours = await _repository.searchTours(
        query: query,
        categoryIds: criteria.categoryIds,
        minPrice: criteria.minPrice,
        maxPrice: criteria.maxPrice,
        minDays: criteria.minDays,
        maxDays: criteria.maxDays,
        minRating: criteria.minRating,
        sort: criteria.sort,
        page: 1,
        limit: _pageSize,
      );

      emit(state.copyWith(
        status: TourSearchStatus.success,
        tours: tours,
        currentPage: 1,
        hasReachedMax: tours.length < _pageSize,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: TourSearchStatus.failure,
        errorMessage: 'Không thể tìm kiếm tour lúc này. Vui lòng thử lại sau.',
      ));
    }
  }

  /// Tải thêm kết quả khi cuộn tới cuối danh sách (Phân trang vô tận - AC4)
  Future<void> loadMore() async {
    if (state.hasReachedMax ||
        state.isLoadingMore ||
        state.status != TourSearchStatus.success) {
      return;
    }

    emit(state.copyWith(isLoadingMore: true));
    final nextPage = state.currentPage + 1;

    try {
      final criteria = state.filterCriteria;
      final moreTours = await _repository.searchTours(
        query: state.searchQuery.trim(),
        categoryIds: criteria.categoryIds,
        minPrice: criteria.minPrice,
        maxPrice: criteria.maxPrice,
        minDays: criteria.minDays,
        maxDays: criteria.maxDays,
        minRating: criteria.minRating,
        sort: criteria.sort,
        page: nextPage,
        limit: _pageSize,
      );

      final updatedTours = List.of(state.tours)..addAll(moreTours);
      emit(state.copyWith(
        tours: updatedTours,
        currentPage: nextPage,
        isLoadingMore: false,
        hasReachedMax: moreTours.length < _pageSize,
      ));
    } catch (_) {
      emit(state.copyWith(isLoadingMore: false));
    }
  }
}
