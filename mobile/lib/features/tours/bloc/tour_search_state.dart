import 'package:equatable/equatable.dart';
import '../models/category_model.dart';
import '../models/tour_model.dart';

enum TourSearchStatus { initial, loading, success, failure }

class TourSearchState extends Equatable {
  final TourSearchStatus status;
  final List<TourModel> tours;
  final List<CategoryModel> categories;
  final String? selectedCategoryId;
  final String searchQuery;
  final String selectedSort;
  final String? errorMessage;

  const TourSearchState({
    this.status = TourSearchStatus.initial,
    this.tours = const [],
    this.categories = const [],
    this.selectedCategoryId,
    this.searchQuery = '',
    this.selectedSort = 'rating',
    this.errorMessage,
  });

  TourSearchState copyWith({
    TourSearchStatus? status,
    List<TourModel>? tours,
    List<CategoryModel>? categories,
    String? selectedCategoryId,
    bool clearCategory = false,
    String? searchQuery,
    String? selectedSort,
    String? errorMessage,
  }) {
    return TourSearchState(
      status: status ?? this.status,
      tours: tours ?? this.tours,
      categories: categories ?? this.categories,
      selectedCategoryId: clearCategory ? null : (selectedCategoryId ?? this.selectedCategoryId),
      searchQuery: searchQuery ?? this.searchQuery,
      selectedSort: selectedSort ?? this.selectedSort,
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
        errorMessage,
      ];
}
