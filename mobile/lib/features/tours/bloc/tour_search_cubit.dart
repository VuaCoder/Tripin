import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/category_model.dart';
import 'tour_search_state.dart';
import 'tours_repository.dart';

class TourSearchCubit extends Cubit<TourSearchState> {
  final ToursRepository _repository;

  TourSearchCubit({ToursRepository? repository})
      : _repository = repository ?? ToursRepository(),
        super(const TourSearchState());

  Future<void> init({
    String? initialCategoryId,
    String? initialQuery,
    List<CategoryModel>? categories,
  }) async {
    emit(state.copyWith(
      selectedCategoryId: initialCategoryId,
      searchQuery: initialQuery ?? '',
      categories: categories ?? state.categories,
      status: TourSearchStatus.loading,
    ));

    // If categories not provided, fetch them
    if (state.categories.isEmpty) {
      try {
        final fetchedCategories = await _repository.getCategories();
        emit(state.copyWith(categories: fetchedCategories));
      } catch (_) {}
    }

    await search();
  }

  void selectCategory(String? categoryId) {
    if (state.selectedCategoryId == categoryId) {
      emit(state.copyWith(clearCategory: true));
    } else {
      emit(state.copyWith(selectedCategoryId: categoryId));
    }
    search();
  }

  void updateQuery(String query) {
    emit(state.copyWith(searchQuery: query));
  }

  void setSort(String sort) {
    emit(state.copyWith(selectedSort: sort));
    search();
  }

  Future<void> search() async {
    emit(state.copyWith(status: TourSearchStatus.loading));
    try {
      final tours = await _repository.searchTours(
        query: state.searchQuery,
        categoryId: state.selectedCategoryId,
        sort: state.selectedSort,
      );
      emit(state.copyWith(
        status: TourSearchStatus.success,
        tours: tours,
      ));
    } catch (e) {
      // Fallback: If search failed, try to filter from sample tours or featured tours
      try {
        final allTours = await _repository.getFeaturedTours();
        final filtered = allTours.where((t) {
          final matchCat = state.selectedCategoryId == null ||
              t.categoryIds.contains(state.selectedCategoryId);
          final matchQuery = state.searchQuery.isEmpty ||
              t.title.toLowerCase().contains(state.searchQuery.toLowerCase()) ||
              t.destination.toLowerCase().contains(state.searchQuery.toLowerCase());
          return matchCat && matchQuery;
        }).toList();

        emit(state.copyWith(
          status: TourSearchStatus.success,
          tours: filtered,
        ));
      } catch (_) {
        emit(state.copyWith(
          status: TourSearchStatus.failure,
          errorMessage: 'Không thể tìm kiếm tour lúc này. Vui lòng thử lại sau.',
        ));
      }
    }
  }
}
