import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/search_history_storage.dart';
import 'package:mobile/features/tours/bloc/tour_search_cubit.dart';
import 'package:mobile/features/tours/bloc/tour_search_state.dart';
import 'package:mobile/features/tours/bloc/tours_repository.dart';
import 'package:mobile/features/tours/models/category_model.dart';
import 'package:mobile/features/tours/models/tour_filter_criteria.dart';
import 'package:mobile/features/tours/models/tour_model.dart';
import 'package:mobile/features/tours/screens/tour_search_screen.dart';
import 'package:mobile/features/tours/widgets/tour_filter_bottom_sheet.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockToursRepository extends ToursRepository {
  List<TourModel> mockTours = [];
  List<CategoryModel> mockCategories = [];
  int searchCallCount = 0;
  Map<String, dynamic>? lastSearchParams;

  MockToursRepository();

  @override
  Future<List<CategoryModel>> getCategories() async {
    return mockCategories;
  }

  @override
  Future<List<TourModel>> searchTours({
    String? query,
    String? categoryId,
    Set<String>? categoryIds,
    String? destination,
    double? minPrice,
    double? maxPrice,
    int? minDays,
    int? maxDays,
    double? minRating,
    String? sort,
    int page = 1,
    int limit = 20,
  }) async {
    searchCallCount++;
    lastSearchParams = {
      'query': query,
      'categoryId': categoryId,
      'categoryIds': categoryIds,
      'destination': destination,
      'minPrice': minPrice,
      'maxPrice': maxPrice,
      'minDays': minDays,
      'maxDays': maxDays,
      'minRating': minRating,
      'sort': sort,
      'page': page,
      'limit': limit,
    };
    return mockTours;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockToursRepository mockRepository;
  late SearchHistoryStorage historyStorage;

  const testTour1 = TourModel(
    id: 'tour-1',
    title: 'Tour Phú Quốc 3N2Đ Siêu Đẹp',
    destination: 'Phú Quốc',
    durationDays: 3,
    basePrice: 3500000,
    ratingAvg: 4.8,
    ratingCount: 120,
    categoryIds: ['cat-bien-dao'],
  );

  const testTour2 = TourModel(
    id: 'tour-2',
    title: 'Tour Đà Lạt Sương Mù 2N1Đ',
    destination: 'Đà Lạt',
    durationDays: 2,
    basePrice: 1800000,
    ratingAvg: 4.2,
    ratingCount: 45,
    categoryIds: ['cat-nghi-duong'],
  );

  const testCategories = [
    CategoryModel(id: 'cat-bien-dao', name: 'Biển đảo', slug: 'bien-dao'),
    CategoryModel(id: 'cat-nghi-duong', name: 'Nghỉ dưỡng', slug: 'nghi-duong'),
  ];

  setUp(() async {
    SharedPreferences.setMockInitialValues({
      'tripri_recent_searches': ['Hà Nội', 'Đà Nẵng'],
    });
    final prefs = await SharedPreferences.getInstance();
    historyStorage = SearchHistoryStorage(prefs: prefs);

    mockRepository = MockToursRepository();
    mockRepository.mockCategories = testCategories;
    mockRepository.mockTours = [testTour1, testTour2];
  });

  group('TourSearchCubit Unit Tests', () {
    test('AC1: Debounce 300ms ignores rapid keystrokes and only fires last', () async {
      final cubit = TourSearchCubit(
        repository: mockRepository,
        historyStorage: historyStorage,
      );

      // Fast typing simulation
      cubit.onQueryChanged('P');
      cubit.onQueryChanged('Ph');
      cubit.onQueryChanged('Phú');
      cubit.onQueryChanged('Phú Quốc');

      // Before 300ms debounce
      expect(mockRepository.searchCallCount, 0);

      // Advance clock past 300ms
      await Future.delayed(const Duration(milliseconds: 350));

      expect(mockRepository.searchCallCount, 1);
      expect(mockRepository.lastSearchParams?['query'], 'Phú Quốc');

      await cubit.close();
    });

    test('AC2: Multi-criteria filtering updates criteria and calls repository correctly', () async {
      final cubit = TourSearchCubit(
        repository: mockRepository,
        historyStorage: historyStorage,
      );

      const criteria = TourFilterCriteria(
        minPrice: 1000000,
        maxPrice: 5000000,
        minDays: 2,
        maxDays: 3,
        categoryIds: {'cat-bien-dao'},
        minRating: 4.0,
        sort: 'price_asc',
      );

      cubit.applyFilters(criteria);
      await Future.delayed(const Duration(milliseconds: 50));

      expect(mockRepository.lastSearchParams?['minPrice'], 1000000.0);
      expect(mockRepository.lastSearchParams?['maxPrice'], 5000000.0);
      expect(mockRepository.lastSearchParams?['minDays'], 2);
      expect(mockRepository.lastSearchParams?['maxDays'], 3);
      expect(mockRepository.lastSearchParams?['minRating'], 4.0);
      expect(mockRepository.lastSearchParams?['sort'], 'price_asc');
      expect(cubit.activeFilterCount, greaterThan(0));

      await cubit.close();
    });

    test('AC4: Infinite scroll pagination increments page and appends tours', () async {
      final cubit = TourSearchCubit(
        repository: mockRepository,
        historyStorage: historyStorage,
      );

      // Page 1 with full page size (10 items) so hasReachedMax is false
      mockRepository.mockTours = List.generate(
        10,
        (i) => TourModel(
          id: 'tour-p1-$i',
          title: 'Tour $i',
          destination: 'Điểm đến $i',
          durationDays: 3,
          basePrice: 1000000 + (i * 100000),
          ratingAvg: 4.5,
          ratingCount: 10,
        ),
      );

      // Initial search page 1
      await cubit.search(isRefresh: true);
      expect(cubit.currentPage, 1);
      expect(cubit.state.tours.length, 10);
      expect(cubit.hasReachedMax, isFalse);

      // Prepare next page result
      mockRepository.mockTours = [
        const TourModel(
          id: 'tour-p2-extra',
          title: 'Tour Sapa 3N2Đ',
          destination: 'Sapa',
          durationDays: 3,
          basePrice: 2200000,
          ratingAvg: 4.7,
          ratingCount: 30,
        ),
      ];

      // Load more page 2
      await cubit.loadMore();
      expect(cubit.currentPage, 2);
      expect(cubit.state.tours.length, 11);
      expect(cubit.state.tours.last.id, 'tour-p2-extra');

      await cubit.close();
    });

    test('AC5: Search history persistence works correctly', () async {
      final cubit = TourSearchCubit(
        repository: mockRepository,
        historyStorage: historyStorage,
      );

      await cubit.init();
      expect(cubit.recentSearches, contains('Hà Nội'));

      cubit.selectHistoryQuery('Nha Trang');
      await Future.delayed(const Duration(milliseconds: 50));
      expect(cubit.recentSearches.first, 'Nha Trang');

      await cubit.removeHistoryItem('Hà Nội');
      expect(cubit.recentSearches, isNot(contains('Hà Nội')));

      await cubit.clearHistory();
      expect(cubit.recentSearches, isEmpty);

      await cubit.close();
    });
  });

  group('TourSearchScreen & Filter BottomSheet Widget Tests', () {
    Widget buildTestWidget({TourSearchCubit? cubit}) {
      return MaterialApp(
        home: TourSearchScreen(cubit: cubit),
      );
    }

    testWidgets('Renders capsule search bar and filter icon button beside search bar', (tester) async {
      final cubit = TourSearchCubit(
        repository: mockRepository,
        historyStorage: historyStorage,
      );
      await cubit.init();

      await tester.pumpWidget(buildTestWidget(cubit: cubit));
      await tester.pumpAndSettle();

      // Verify 3D capsule search bar exists with Vietnamese text
      expect(find.byKey(const Key('tour_search_capsule_btn')), findsOneWidget);
      expect(find.text('Địa điểm bất kỳ'), findsOneWidget);
      expect(find.text('Bất kỳ tuần nào · Thêm khách'), findsOneWidget);

      // Verify filter icon button exists right next to search bar
      expect(find.byKey(const Key('tour_search_filter_icon_btn')), findsOneWidget);
      expect(find.byIcon(Icons.tune_rounded), findsOneWidget);

      await cubit.close();
    });

    testWidgets('Tapping filter icon opens TourFilterBottomSheet with all sections', (tester) async {
      final cubit = TourSearchCubit(
        repository: mockRepository,
        historyStorage: historyStorage,
      );
      await cubit.init();

      await tester.pumpWidget(buildTestWidget(cubit: cubit));
      await tester.pumpAndSettle();

      // Tap filter icon
      await tester.tap(find.byKey(const Key('tour_search_filter_icon_btn')));
      await tester.pumpAndSettle();

      // BottomSheet should be displayed
      expect(find.byType(TourFilterBottomSheet), findsOneWidget);
      expect(find.text('Bộ lọc'), findsOneWidget);
      expect(find.text('Khoảng giá'), findsOneWidget);
      expect(find.text('Danh mục du lịch'), findsOneWidget);
      expect(find.text('Đánh giá tối thiểu'), findsOneWidget);
      expect(find.text('Xóa tất cả'), findsOneWidget);
      expect(find.textContaining('Hiển thị'), findsOneWidget);

      await cubit.close();
    });

    testWidgets('AC3: Displays empty state when no tours match with reset button', (tester) async {
      mockRepository.mockTours = []; // Return empty list
      final cubit = TourSearchCubit(
        repository: mockRepository,
        historyStorage: historyStorage,
      );
      await cubit.init();

      await tester.pumpWidget(buildTestWidget(cubit: cubit));
      await tester.pumpAndSettle();

      expect(find.text('Không tìm thấy tour phù hợp'), findsOneWidget);
      expect(find.text('Đặt lại bộ lọc'), findsOneWidget);

      // Tapping "Đặt lại bộ lọc"
      mockRepository.mockTours = [testTour1];
      await tester.tap(find.text('Đặt lại bộ lọc'));
      await tester.pumpAndSettle();

      expect(find.text('Tour tại Phú Quốc'), findsOneWidget);

      await cubit.close();
    });
  });
}
