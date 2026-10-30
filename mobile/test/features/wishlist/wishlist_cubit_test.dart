import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/tours/models/tour_model.dart';
import 'package:mobile/features/wishlist/bloc/wishlist_cubit.dart';
import 'package:mobile/features/wishlist/bloc/wishlist_repository.dart';
import 'package:mobile/features/wishlist/bloc/wishlist_state.dart';
import 'package:mobile/features/wishlist/models/recently_viewed_model.dart';
import 'package:mobile/features/wishlist/models/wishlist_collection_model.dart';
import 'package:mobile/features/wishlist/models/wishlist_item_model.dart';
import 'package:mobile/features/wishlist/storage/wishlist_storage.dart';
import 'package:mobile/features/wishlist/widgets/saved_to_wishlist_banner.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockWishlistRepository extends WishlistRepository {
  bool isAuth = true;
  List<WishlistItemModel> mockItems = [];
  final List<String> addCalls = [];
  final List<String> removeCalls = [];
  bool throwOnAdd = false;
  bool throwOnRemove = false;

  @override
  Future<bool> isAuthenticated() async => isAuth;

  @override
  Future<List<WishlistItemModel>> getWishlist({int page = 1, int limit = 50}) async {
    return mockItems;
  }

  @override
  Future<void> addToWishlist(String tourId) async {
    if (throwOnAdd) throw Exception('Network error');
    addCalls.add(tourId);
  }

  @override
  Future<void> removeFromWishlist(String tourId) async {
    if (throwOnRemove) throw Exception('Network error');
    removeCalls.add(tourId);
  }
}

class FakeWishlistStorage extends WishlistStorage {
  List<WishlistCollectionModel> storedCollections = [];
  List<RecentlyViewedTourModel> storedRecentlyViewed = [];

  @override
  Future<List<WishlistCollectionModel>> loadCollections() async {
    return storedCollections;
  }

  @override
  Future<void> saveCollections(List<WishlistCollectionModel> collections) async {
    storedCollections = collections;
  }

  @override
  Future<List<RecentlyViewedTourModel>> loadRecentlyViewed() async {
    return storedRecentlyViewed;
  }

  @override
  Future<void> saveRecentlyViewed(List<RecentlyViewedTourModel> items) async {
    storedRecentlyViewed = items;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  const testTour1 = TourModel(
    id: 'tour-01',
    title: 'Hạ Long 3N2Đ',
    destination: 'Quảng Ninh',
    durationDays: 3,
    basePrice: 2500000,
    coverImage: 'https://images.unsplash.com/photo-halong',
  );

  const testTour2 = TourModel(
    id: 'tour-02',
    title: 'Phú Quốc 4N3Đ',
    destination: 'Kiên Giang',
    durationDays: 4,
    basePrice: 3800000,
  );

  group('WishlistCubit Multi-Collection Tests', () {
    late MockWishlistRepository mockRepo;
    late FakeWishlistStorage fakeStorage;
    late WishlistCubit cubit;

    setUp(() {
      mockRepo = MockWishlistRepository();
      fakeStorage = FakeWishlistStorage();
      cubit = WishlistCubit(repository: mockRepo, storage: fakeStorage);
    });

    tearDown(() {
      cubit.close();
    });

    test('Initial state has default empty values', () {
      expect(cubit.state.status, WishlistStatus.initial);
      expect(cubit.state.collections, isEmpty);
      expect(cubit.state.hasCustomWishlists, isFalse);
      expect(cubit.state.hasUnseenWishlistBadge, isFalse);
      expect(cubit.isFavorite('tour-01'), isFalse);
    });

    test('Create collection with max 50 characters and initial tour sets hasUnseenWishlistBadge to true', () async {
      final col = await cubit.createCollection('ngu', initialTour: testTour1);

      expect(col.name, 'ngu');
      expect(cubit.state.collections.length, 1);
      expect(cubit.state.collections.first.name, 'ngu');
      expect(cubit.state.hasCustomWishlists, isTrue);
      expect(cubit.state.hasUnseenWishlistBadge, isTrue);
      expect(cubit.isFavorite('tour-01'), isTrue);
      expect(mockRepo.addCalls, contains('tour-01'));
      expect(fakeStorage.storedCollections.length, 1);

      // Khi bấm xem tab wishlist, markWishlistSeen tắt chấm xanh
      cubit.markWishlistSeen();
      expect(cubit.state.hasUnseenWishlistBadge, isFalse);
    });

    test('Rename collection updates collection name and persists', () async {
      final col = await cubit.createCollection('ngu', initialTour: testTour1);
      await cubit.renameCollection(col.id, 'ok');

      expect(cubit.state.collections.first.name, 'ok');
      expect(fakeStorage.storedCollections.first.name, 'ok');
    });

    test('Create collection clamps names longer than 50 characters to 50', () async {
      final longName = 'A' * 60;
      final col = await cubit.createCollection(longName);

      expect(col.name.length, 50);
      expect(col.name, 'A' * 50);
    });

    test('Add tour to existing collection updates collection and sets hasUnseenWishlistBadge', () async {
      await cubit.createCollection('ngu', initialTour: testTour1);
      cubit.markWishlistSeen();
      expect(cubit.state.hasUnseenWishlistBadge, isFalse);

      final colId = cubit.state.collections.first.id;
      await cubit.addTourToCollection(colId, testTour2);

      expect(cubit.state.collections.first.tours.length, 2);
      expect(cubit.state.hasUnseenWishlistBadge, isTrue);
      expect(cubit.isFavorite('tour-01'), isTrue);
      expect(cubit.isFavorite('tour-02'), isTrue);
      expect(cubit.state.collections.first.savedSubtitle, '2 đã lưu');
      expect(mockRepo.addCalls, contains('tour-02'));
    });

    test('Delete collection removes it and resets editMode when all deleted', () async {
      await cubit.createCollection('ngu', initialTour: testTour1);
      final colId = cubit.state.collections.first.id;

      cubit.setEditMode(true);
      expect(cubit.state.isEditMode, isTrue);

      await cubit.deleteCollection(colId);

      expect(cubit.state.collections, isEmpty);
      expect(cubit.state.hasCustomWishlists, isFalse);
      expect(cubit.state.isEditMode, isFalse);
    });

    test('recordRecentlyViewed prepends tour with Vietnamese relative time', () {
      cubit.recordRecentlyViewed(testTour1);
      cubit.recordRecentlyViewed(testTour2);

      expect(cubit.state.recentlyViewed.length, 2);
      expect(cubit.state.recentlyViewed.first.tour.id, 'tour-02');
      expect(cubit.state.recentlyViewed.first.relativeTime, 'Hôm nay');
    });

    test('removeRecentlyViewed removes tour from recently viewed list', () async {
      cubit.recordRecentlyViewed(testTour1);
      cubit.recordRecentlyViewed(testTour2);

      await cubit.removeRecentlyViewed('tour-01');

      expect(cubit.state.recentlyViewed.length, 1);
      expect(cubit.state.recentlyViewed.first.tour.id, 'tour-02');
    });

    testWidgets('Guest user tapping heart shows LoginRequiredDialog', (tester) async {
      mockRepo.isAuth = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () => cubit.handleHeartTap(context: context, tour: testTour1),
                child: const Text('Tap Heart'),
              );
            },
          ),
        ),
      );

      await tester.tap(find.text('Tap Heart'));
      await tester.pumpAndSettle();

      expect(find.text('Yêu cầu đăng nhập'), findsOneWidget);
    });

    testWidgets('Tapping red heart removes tour and shows Xoá khỏi banner without Thay đổi', (tester) async {
      mockRepo.isAuth = true;
      // Tạo trước 1 wishlist chứa testTour1
      await cubit.createCollection('ok', initialTour: testTour1);
      expect(cubit.isFavorite(testTour1.id), isTrue);

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () => cubit.handleHeartTap(context: context, tour: testTour1),
                child: const Text('Tap Heart'),
              );
            },
          ),
        ),
      );

      // Bấm vào tim đỏ
      await tester.tap(find.text('Tap Heart'));
      await tester.pump();

      // Kiểm tra tim đỏ đã bị gỡ
      expect(cubit.isFavorite(testTour1.id), isFalse);

      // Kiểm tra banner hiển thị 'Xoá khỏi ok' và KHÔNG có chữ 'Thay đổi'
      expect(find.text('Xoá khỏi ok'), findsOneWidget);
      expect(find.text('Thay đổi'), findsNothing);

      SavedToWishlistBanner.hide();
      await tester.pump();
    });

    test('Deleting collection removes red hearts for its tours', () async {
      mockRepo.isAuth = true;
      final col = await cubit.createCollection('Mùa hè', initialTour: testTour1);
      expect(cubit.isFavorite(testTour1.id), isTrue);

      // Xóa collection 'Mùa hè'
      await cubit.deleteCollection(col.id);

      // Không còn danh sách nào -> Bỏ hết tim
      expect(cubit.state.collections, isEmpty);
      expect(cubit.isFavorite(testTour1.id), isFalse);
    });
  });
}
