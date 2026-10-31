import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/bookings/storage/pending_booking_storage.dart';
import 'package:mobile/features/tours/bloc/home_discovery_cubit.dart';
import 'package:mobile/features/tours/bloc/home_discovery_state.dart';
import 'package:mobile/features/tours/bloc/tours_repository.dart';
import 'package:mobile/features/tours/models/category_model.dart';
import 'package:mobile/features/tours/models/tour_model.dart';
import 'package:mobile/features/tours/screens/home_discovery_screen.dart';
import 'package:mobile/features/tours/widgets/tour_card_horizontal.dart';
import 'package:mobile/features/wishlist/bloc/wishlist_cubit.dart';
import 'package:mobile/features/wishlist/screens/recently_viewed_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FakeHomeDiscoveryCubit extends Cubit<HomeDiscoveryState> implements HomeDiscoveryCubit {
  FakeHomeDiscoveryCubit(super.initialState);

  @override
  ToursRepository get repository => ToursRepository();

  @override
  Future<void> loadHomeData() async {}

  @override
  Future<void> refreshHomeData() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  const sampleTour = TourModel(
    id: 'tour-hcm-1',
    title: 'Tour Khám phá Sài Gòn Hoa Lệ',
    destination: 'TP. Hồ Chí Minh, Việt Nam',
    coverImage: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482',
    basePrice: 1500000,
    ratingAvg: 5.0,
    ratingCount: 42,
    durationDays: 2,
    categoryIds: ['cat-city'],
  );

  group('PendingBookingStorage Tests', () {
    test('saveDraft, getDraft, and clearDraft work as expected', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final storage = PendingBookingStorage(prefs: prefs);

      expect(await storage.getDraft(), isNull);

      final draft = PendingBookingDraft(
        tourId: 'tour-123',
        tourTitle: 'Tour Vịnh Hạ Long',
        destination: 'Hạ Long, Quảng Ninh',
        departureId: 'dep-1',
        departureDate: DateTime(2026, 11, 3),
        endDate: DateTime(2026, 11, 5),
        durationDays: 3,
        adultsCount: 2,
        childrenCount: 1,
        infantsCount: 0,
        totalPrice: 4500000,
        savedAt: DateTime.now(),
      );

      await storage.saveDraft(draft);
      final retrieved = await storage.getDraft();

      expect(retrieved, isNotNull);
      expect(retrieved!.tourId, 'tour-123');
      expect(retrieved.tourTitle, 'Tour Vịnh Hạ Long');
      expect(retrieved.destination, 'Hạ Long, Quảng Ninh');
      expect(retrieved.totalGuests, 3);
      expect(retrieved.totalPrice, 4500000);

      await storage.clearDraft();
      expect(await storage.getDraft(), isNull);
    });
  });

  group('HomeDiscoveryScreen Resumption & Recently Viewed Tests', () {
    testWidgets('Renders Pending Resumption Card at top directly beneath search bar', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final storage = PendingBookingStorage(prefs: prefs);

      final draft = PendingBookingDraft(
        tourId: sampleTour.id,
        tourTitle: sampleTour.title,
        destination: 'Hồ Chí Minh',
        departureId: 'dep-hcm',
        departureDate: DateTime(2026, 11, 3),
        endDate: DateTime(2026, 11, 4),
        durationDays: 2,
        adultsCount: 1,
        childrenCount: 0,
        infantsCount: 0,
        totalPrice: 1500000,
        savedAt: DateTime.now(),
      );
      await storage.saveDraft(draft);

      final fakeCubit = FakeHomeDiscoveryCubit(
        const HomeDiscoveryLoaded(
          categories: [CategoryModel(id: 'cat-1', name: 'Thành phố', slug: 'city')],
          featuredTours: [sampleTour],
          latestTours: [sampleTour],
          promotions: [],
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider<HomeDiscoveryCubit>.value(
            value: fakeCubit,
            child: const HomeDiscoveryScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Card appears with "Hoàn thành tour Hồ Chí Minh"
      expect(find.text('Hoàn thành tour Hồ Chí Minh'), findsOneWidget);
      expect(find.textContaining('3 – 4 Thg 11 · 1 khách'), findsOneWidget);
      expect(find.byIcon(Icons.chevron_right_rounded), findsWidgets);
    });

    testWidgets('Renders Tour đã xem gần đây on top without any tag (Ảnh 3)', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final wishlistCubit = WishlistCubit();
      wishlistCubit.recordRecentlyViewed(sampleTour);

      final fakeCubit = FakeHomeDiscoveryCubit(
        const HomeDiscoveryLoaded(
          categories: [CategoryModel(id: 'cat-1', name: 'Thành phố', slug: 'city')],
          featuredTours: [sampleTour],
          latestTours: [sampleTour],
          promotions: [],
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: MultiBlocProvider(
            providers: [
              BlocProvider<HomeDiscoveryCubit>.value(value: fakeCubit),
              BlocProvider<WishlistCubit>.value(value: wishlistCubit),
            ],
            child: const HomeDiscoveryScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Header "Tour đã xem gần đây" is visible on top
      expect(find.text('Tour đã xem gần đây'), findsOneWidget);

      // Section header uses circular arrow icon
      expect(find.byIcon(Icons.arrow_forward_rounded), findsWidgets);

      // Cards inside Recently Viewed do NOT have any "Được khách yêu thích" badge / tag
      final cards = tester.widgetList<TourCardHorizontal>(find.byType(TourCardHorizontal)).toList();
      expect(cards.isNotEmpty, isTrue);

      // First card belongs to Recently Viewed and has showBadge = false
      expect(cards.first.showBadge, isFalse);
      expect(cards.first.useDestinationTitle, isTrue);

      // Tapping circular arrow on Recently Viewed opens RecentlyViewedScreen
      await tester.tap(find.byIcon(Icons.arrow_forward_rounded).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.byType(RecentlyViewedScreen), findsOneWidget);
    });
  });
}
