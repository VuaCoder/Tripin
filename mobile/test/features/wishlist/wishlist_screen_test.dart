import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/tours/models/tour_model.dart';
import 'package:mobile/features/wishlist/bloc/wishlist_cubit.dart';
import 'package:mobile/features/wishlist/bloc/wishlist_repository.dart';
import 'package:mobile/features/wishlist/models/recently_viewed_model.dart';
import 'package:mobile/features/wishlist/models/wishlist_collection_model.dart';
import 'package:mobile/features/wishlist/models/wishlist_item_model.dart';
import 'package:mobile/features/wishlist/screens/recently_viewed_screen.dart';
import 'package:mobile/features/wishlist/screens/wishlist_collection_detail_screen.dart';
import 'package:mobile/features/wishlist/screens/wishlist_screen.dart';
import 'package:mobile/features/wishlist/storage/wishlist_storage.dart';
import 'package:mobile/features/wishlist/widgets/recently_viewed_collage_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FakeWishlistRepository extends WishlistRepository {
  bool isAuth = true;
  List<WishlistItemModel> items = [];

  @override
  Future<bool> isAuthenticated() async => isAuth;

  @override
  Future<List<WishlistItemModel>> getWishlist({int page = 1, int limit = 50}) async {
    return items;
  }
}

class FakeWishlistStorage extends WishlistStorage {
  List<WishlistCollectionModel> storedCollections = [];
  List<RecentlyViewedTourModel> storedRecentlyViewed = [];
  List<RecentlyViewedTourModel> storedAuditLog = [];

  @override
  Future<List<WishlistCollectionModel>> loadCollections({String? userId}) async {
    return storedCollections;
  }

  @override
  Future<void> saveCollections(List<WishlistCollectionModel> collections, {String? userId}) async {
    storedCollections = collections;
  }

  @override
  Future<List<RecentlyViewedTourModel>> loadRecentlyViewed({String? userId}) async {
    return storedRecentlyViewed;
  }

  @override
  Future<void> saveRecentlyViewed(List<RecentlyViewedTourModel> items, {String? userId}) async {
    storedRecentlyViewed = items;
  }

  @override
  Future<void> recordToAuditLog(List<RecentlyViewedTourModel> items, {String? userId}) async {
    final map = <String, RecentlyViewedTourModel>{};
    for (final item in items) {
      map[item.tour.id] = item;
    }
    for (final item in storedAuditLog) {
      map.putIfAbsent(item.tour.id, () => item);
    }
    storedAuditLog = map.values.toList();
  }

  @override
  Future<List<RecentlyViewedTourModel>> loadAuditLog({String? userId}) async {
    return storedAuditLog;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  const sampleTour = TourModel(
    id: 'tour-101',
    title: 'Tour Đà Nẵng - Hội An',
    destination: 'Đà Nẵng',
    durationDays: 3,
    basePrice: 3200000,
    ratingAvg: 4.9,
  );

  group('WishlistScreen & Detail Screens Tests', () {
    testWidgets('Displays Yêu thích title and Gần đây card by default', (tester) async {
      final fakeRepo = FakeWishlistRepository();
      final fakeStorage = FakeWishlistStorage();
      final cubit = WishlistCubit(repository: fakeRepo, storage: fakeStorage);

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider.value(
            value: cubit,
            child: const WishlistScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tiêu đề lớn Yêu thích
      expect(find.text('Yêu thích'), findsOneWidget);
      // Card Gần đây và collage
      expect(find.text('Gần đây'), findsOneWidget);
      expect(find.text('Hôm nay'), findsOneWidget);
      expect(find.byType(RecentlyViewedCollageWidget), findsOneWidget);
      // Khi chưa có custom wishlist nào, nút Chỉnh sửa KHÔNG hiển thị
      expect(find.text('Chỉnh sửa'), findsNothing);
    });

    testWidgets('Displays Chỉnh sửa button when custom wishlists exist, and toggles edit mode', (tester) async {
      final fakeRepo = FakeWishlistRepository();
      final fakeStorage = FakeWishlistStorage();
      final cubit = WishlistCubit(repository: fakeRepo, storage: fakeStorage);

      // Tạo wishlist "ngu"
      await cubit.createCollection('ngu', initialTour: sampleTour);

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider.value(
            value: cubit,
            child: const WishlistScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Có custom wishlist -> hiển thị nút Chỉnh sửa và tên "ngu"
      expect(find.text('Yêu thích'), findsOneWidget);
      expect(find.text('Chỉnh sửa'), findsOneWidget);
      expect(find.text('ngu'), findsOneWidget);
      expect(find.text('1 đã lưu'), findsOneWidget);

      // Bấm Chỉnh sửa
      await tester.tap(find.text('Chỉnh sửa'));
      await tester.pumpAndSettle();

      // Nút chuyển thành "Xong" và xuất hiện nút xoá dạng (x) trắng
      expect(find.text('Xong'), findsOneWidget);
      expect(find.byIcon(Icons.close_rounded), findsOneWidget);
    });

    testWidgets('When all custom wishlists are deleted, Chỉnh sửa button disappears', (tester) async {
      final fakeRepo = FakeWishlistRepository();
      final fakeStorage = FakeWishlistStorage();
      final cubit = WishlistCubit(repository: fakeRepo, storage: fakeStorage);

      await cubit.createCollection('ngu', initialTour: sampleTour);

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider.value(
            value: cubit,
            child: const WishlistScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Chỉnh sửa'), findsOneWidget);

      // Bấm nút Chỉnh sửa để bật chế độ xoá
      await tester.tap(find.text('Chỉnh sửa'));
      await tester.pumpAndSettle();

      // Bấm vào nút xoá (icon close_rounded) trên card "ngu"
      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pumpAndSettle();

      // Xác nhận xoá trong Dialog
      expect(find.text('Xóa danh sách yêu thích?'), findsOneWidget);
      await tester.tap(find.text('Xóa'));
      await tester.pumpAndSettle();

      // Bây giờ chỉ còn mỗi "Gần đây" -> Nút Chỉnh sửa hoàn toàn biến mất
      expect(find.text('Chỉnh sửa'), findsNothing);
      expect(find.text('Xong'), findsNothing);
      expect(find.text('Gần đây'), findsOneWidget);
      expect(find.text('ngu'), findsNothing);
    });

    testWidgets('RecentlyViewedScreen: Normal mode shows hearts, Edit mode shows (x) and delete confirmation popup', (tester) async {
      final fakeRepo = FakeWishlistRepository();
      final fakeStorage = FakeWishlistStorage();
      final cubit = WishlistCubit(repository: fakeRepo, storage: fakeStorage);

      // Ghi nhận tour vào mục gần đây
      cubit.recordRecentlyViewed(sampleTour);

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider.value(
            value: cubit,
            child: const RecentlyViewedScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Ảnh 1: Tiêu đề Gần đây, nhóm Hôm nay, tour title, nút pill Chỉnh sửa
      expect(find.text('Gần đây'), findsOneWidget);
      expect(find.text('Hôm nay'), findsOneWidget);
      expect(find.text('Tour Đà Nẵng - Hội An'), findsOneWidget);
      expect(find.text('Chỉnh sửa'), findsOneWidget);
      // Nút tim có mặt trong chế độ xem bình thường
      expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);

      // Bấm "Chỉnh sửa" -> chuyển sang Ảnh 2
      await tester.tap(find.text('Chỉnh sửa'));
      await tester.pumpAndSettle();

      // Ảnh 2: Nút đổi thành "Xong", xuất hiện nút tròn màu trắng (x) ở góc trái
      expect(find.text('Xong'), findsOneWidget);
      expect(find.byIcon(Icons.close_rounded), findsOneWidget);

      // Bấm vào nút (x) để mở popup xác nhận xóa
      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pumpAndSettle();

      // Dialog xác nhận xuất hiện
      expect(find.text('Xóa khỏi mục gần đây?'), findsOneWidget);
      expect(find.text('Hủy'), findsOneWidget);
      expect(find.text('Xóa'), findsOneWidget);

      // Bấm "Xóa"
      await tester.tap(find.text('Xóa'));
      await tester.pumpAndSettle();

      // Tour đã bị xóa khỏi mục Gần đây
      expect(find.text('Chưa có tour xem gần đây'), findsOneWidget);
      expect(find.text('Tour Đà Nẵng - Hội An'), findsNothing);
    });

    testWidgets('WishlistCollectionDetailScreen: Shows 3-dots with Sửa tên and Xóa, no share or dates/guests pills', (tester) async {
      final fakeRepo = FakeWishlistRepository();
      final fakeStorage = FakeWishlistStorage();
      final cubit = WishlistCubit(repository: fakeRepo, storage: fakeStorage);

      final col = await cubit.createCollection('ok', initialTour: sampleTour);

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider.value(
            value: cubit,
            child: WishlistCollectionDetailScreen(
              collectionId: col.id,
              title: col.name,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tiêu đề lớn "ok"
      expect(find.text('ok'), findsOneWidget);
      // Tour Đà Nẵng - Hội An dạng lưới 2 cột
      expect(find.text('Tour Đà Nẵng - Hội An'), findsOneWidget);
      // Bỏ đi phần share và Dates · Guests
      expect(find.text('Dates · Guests'), findsNothing);
      expect(find.text('Share'), findsNothing);

      // Nút 3 chấm (...)
      expect(find.byIcon(Icons.more_horiz_rounded), findsOneWidget);

      // Bấm nút 3 chấm (...) mở Settings
      await tester.tap(find.byIcon(Icons.more_horiz_rounded));
      await tester.pumpAndSettle();

      // Hiện Cài đặt với 2 mục: Sửa tên và Xóa
      expect(find.text('Cài đặt'), findsOneWidget);
      expect(find.text('Sửa tên'), findsOneWidget);
      expect(find.text('Xóa'), findsOneWidget);

      // Bấm "Sửa tên"
      await tester.tap(find.text('Sửa tên'));
      await tester.pumpAndSettle();

      expect(find.text('Đổi tên danh sách'), findsOneWidget);
      expect(find.text('Lưu'), findsOneWidget);
    });

    testWidgets('RecentlyViewedCollageWidget: When only 2 tours exist, displays exactly 2 photos side by side without 4-quadrant duplication', (tester) async {
      const tour1 = TourModel(
        id: 't-1',
        title: 'Tour Hà Nội',
        destination: 'Hà Nội',
        durationDays: 1,
        basePrice: 500000,
        coverImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93',
      );
      const tour2 = TourModel(
        id: 't-2',
        title: 'Tour Sài Gòn',
        destination: 'Sài Gòn',
        durationDays: 2,
        basePrice: 800000,
        coverImage: 'https://images.unsplash.com/photo-1528127269322-539801943592',
      );

      final items = [
        RecentlyViewedTourModel(tour: tour1, viewedAt: DateTime.now()),
        RecentlyViewedTourModel(tour: tour2, viewedAt: DateTime.now()),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 300,
              height: 300,
              child: RecentlyViewedCollageWidget(items: items),
            ),
          ),
        ),
      );

      // Khi có đúng 2 tour, widget sử dụng 1 Row duy nhất với 2 Expanded con
      expect(find.byType(RecentlyViewedCollageWidget), findsOneWidget);
      // Tìm thấy đúng 2 CachedNetworkImage (không phải 4 như dạng lưới 2x2 lặp lại)
      final networkImages = find.descendant(
        of: find.byType(RecentlyViewedCollageWidget),
        matching: find.byType(CachedNetworkImage),
      );
      expect(networkImages, findsNWidgets(2));
    });
  });
}
