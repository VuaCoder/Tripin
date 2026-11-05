import 'package:equatable/equatable.dart';

import '../models/category_model.dart';
import '../models/tour_filter_criteria.dart';
import '../models/tour_model.dart';

enum TourSearchStatus { initial, loading, success, failure }

class TourSearchState extends Equatable {
  final TourSearchStatus status;
  final List<TourModel> tours;
  final List<CategoryModel> categories;
  final String? selectedCategoryId;
  final String searchQuery;
  final String selectedSort;
  final TourFilterCriteria filterCriteria;
  final List<String> recentSearches;
  final int currentPage;
  final bool hasReachedMax;
  final bool isLoadingMore;
  final bool isSearchFieldFocused;
  final String? searchDatesSummary;
  final String? searchGuestsSummary;
  final String? errorMessage;

  const TourSearchState({
    this.status = TourSearchStatus.initial,
    this.tours = const [],
    this.categories = const [],
    this.selectedCategoryId,
    this.searchQuery = '',
    this.selectedSort = 'newest',
    this.filterCriteria = TourFilterCriteria.empty,
    this.recentSearches = const [],
    this.currentPage = 1,
    this.hasReachedMax = false,
    this.isLoadingMore = false,
    this.isSearchFieldFocused = false,
    this.searchDatesSummary,
    this.searchGuestsSummary,
    this.errorMessage,
  });

  /// Tổng số bộ lọc đang áp dụng
  int get activeFilterCount => filterCriteria.activeFilterCount;

  TourSearchState copyWith({
    TourSearchStatus? status,
    List<TourModel>? tours,
    List<CategoryModel>? categories,
    String? selectedCategoryId,
    bool clearCategory = false,
    String? searchQuery,
    String? selectedSort,
    TourFilterCriteria? filterCriteria,
    List<String>? recentSearches,
    int? currentPage,
    bool? hasReachedMax,
    bool? isLoadingMore,
    bool? isSearchFieldFocused,
    String? searchDatesSummary,
    String? searchGuestsSummary,
    String? errorMessage,
  }) {
    final effectiveCriteria = filterCriteria ?? this.filterCriteria;
    final effectiveSort =
        selectedSort ?? (filterCriteria?.sort ?? this.selectedSort);

    return TourSearchState(
      status: status ?? this.status,
      tours: tours ?? this.tours,
      categories: categories ?? this.categories,
      selectedCategoryId: clearCategory
          ? null
          : (selectedCategoryId ?? this.selectedCategoryId),
      searchQuery: searchQuery ?? this.searchQuery,
      selectedSort: effectiveSort,
      filterCriteria: effectiveCriteria,
      recentSearches: recentSearches ?? this.recentSearches,
      currentPage: currentPage ?? this.currentPage,
      hasReachedMax: hasReachedMax ?? this.hasReachedMax,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      isSearchFieldFocused: isSearchFieldFocused ?? this.isSearchFieldFocused,
      searchDatesSummary: searchDatesSummary ?? this.searchDatesSummary,
      searchGuestsSummary: searchGuestsSummary ?? this.searchGuestsSummary,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  @override
  List<Object?> get props => [
    status,
    tours,
    categories,
    selectedCategoryId,
    searchQuery,
    selectedSort,
    filterCriteria,
    recentSearches,
    currentPage,
    hasReachedMax,
    isLoadingMore,
    isSearchFieldFocused,
    searchDatesSummary,
    searchGuestsSummary,
    errorMessage,
  ];
}
