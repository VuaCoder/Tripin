import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/tours/bloc/home_discovery_cubit.dart';
import 'package:mobile/features/tours/bloc/home_discovery_state.dart';
import 'package:mobile/features/tours/models/category_model.dart';
import 'package:mobile/features/tours/models/promotion_banner_model.dart';
import 'package:mobile/features/tours/models/tour_model.dart';
import 'package:mobile/features/tours/screens/home_discovery_screen.dart';
import 'package:mobile/features/tours/screens/tour_search_screen.dart';
import 'package:mobile/features/tours/widgets/banner_carousel_widget.dart';
import 'package:mobile/features/tours/widgets/category_grid_widget.dart';
import 'package:mobile/features/tours/widgets/network_error_widget.dart';
import 'package:mobile/features/tours/widgets/tour_card_horizontal.dart';
import 'package:mobile/features/tours/widgets/tour_shimmer_loading.dart';

class FakeHomeDiscoveryCubit extends Cubit<HomeDiscoveryState>
    implements HomeDiscoveryCubit {
  bool loadHomeDataCalled = false;
  bool refreshHomeDataCalled = false;

  FakeHomeDiscoveryCubit(super.initialState);

  @override
  Future<void> loadHomeData() async {
    loadHomeDataCalled = true;
  }

  @override
  Future<void> refreshHomeData() async {
    refreshHomeDataCalled = true;
  }
}

void main() {
  const testCategories = [
    CategoryModel(id: 'cat-bien-dao', name: 'Biển đảo', slug: 'bien-dao'),
    CategoryModel(id: 'cat-van-hoa', name: 'Văn hóa', slug: 'van-hoa'),
  ];

  const testPromotions = [
    PromotionBannerModel(
      id: 'promo-01',
      title: 'Hạ Long Kỳ Vĩ - Du Thuyền 5 Sao',
      subtitle: 'Nghỉ dưỡng thượng lưu trên vịnh di sản',
      imageUrl: '',
      badgeText: 'GIẢM ĐẾN 35%',
      promoCode: 'HALONG35',
      discountText: 'Tiết kiệm 1.200.000₫',
      ctaText: 'Khám phá ngay',
    ),
    PromotionBannerModel(
      id: 'promo-02',
      title: 'Phú Quốc - Thiên Đường Nắng Vàng',
      subtitle: 'Lặn ngắm san hô 4 đảo',
      imageUrl: '',
      badgeText: 'ƯU ĐÃI MÙA HÈ',
      promoCode: 'PHUQUOC25',
      discountText: 'Giảm ngay 25%',
      ctaText: 'Săn deal ngay',
    ),
  ];

  const testFeaturedTours = [
    TourModel(
      id: 'tour-01',
      title: 'Du Thuyền Hạ Long Heritage 5 Sao',
      destination: 'Hạ Long, Quảng Ninh',
      durationDays: 2,
      basePrice: 3250000,
      coverImage: '',
      categoryIds: ['cat-bien-dao'],
      ratingAvg: 4.9,
      ratingCount: 128,
    ),
  ];

  const testLatestTours = [
    TourModel(
      id: 'tour-02',
      title: 'Khám Phá Sapa Chạm Đỉnh Fansipan',
      destination: 'Sa Pa, Lào Cai',
      durationDays: 3,
      basePrice: 2450000,
      coverImage: '',
      categoryIds: ['cat-kham-pha'],
      ratingAvg: 4.8,
      ratingCount: 64,
      agencyName: 'Tây Bắc Travel',
    ),
  ];

  group('[FLOW-04] Home Discovery, Banners & Airbnb-style Tour Cards Tests', () {
    testWidgets('AC1: Displays sticky 3D search button and TourShimmerLoading during loading state', (tester) async {
      final fakeCubit = FakeHomeDiscoveryCubit(const HomeDiscoveryLoading());

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider<HomeDiscoveryCubit>.value(
            value: fakeCubit,
            child: const HomeDiscoveryScreen(),
          ),
        ),
      );

      // Verify centered 3D search bar text
      expect(find.text('Bắt đầu cuộc hành trình'), findsOneWidget);
      // Verify greeting & bell icon are removed
      expect(find.textContaining('Chào buổi'), findsNothing);
      expect(find.byIcon(Icons.notifications_none_rounded), findsNothing);
      // Verify shimmer loading is present
      expect(find.byType(TourShimmerLoading), findsOneWidget);
    });

    testWidgets('AC2: Promotional Banner Carousel renders ad components without emojis', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BannerCarouselWidget(
              banners: testPromotions,
            ),
          ),
        ),
      );
      await tester.pump();

      // Check ad components
      expect(find.text('GIẢM ĐẾN 35%'), findsOneWidget);
      expect(find.text('HALONG35'), findsOneWidget);
      expect(find.text('Hạ Long Kỳ Vĩ - Du Thuyền 5 Sao'), findsOneWidget);
      expect(find.text('Nghỉ dưỡng thượng lưu trên vịnh di sản'), findsOneWidget);
      expect(find.text('Tiết kiệm 1.200.000₫'), findsOneWidget);
      expect(find.text('Khám phá ngay'), findsOneWidget);

      // Verify swipe to next slide
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      expect(find.text('ƯU ĐÃI MÙA HÈ'), findsOneWidget);
      expect(find.text('PHUQUOC25'), findsOneWidget);
      expect(find.text('Phú Quốc - Thiên Đường Nắng Vàng'), findsOneWidget);
      expect(find.text('Săn deal ngay'), findsOneWidget);
    });

    testWidgets('AC3: TourCardHorizontal matches Airbnb-style card UI (Được khách yêu thích badge, heart icon, clean metadata line)', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TourCardHorizontal(tour: testFeaturedTours[0]),
          ),
        ),
      );
      await tester.pump();

      // 1. Vietnamese "Được khách yêu thích" badge on top-left of image
      expect(find.text('Được khách yêu thích'), findsOneWidget);

      // 2. Heart icon button on top-right
      expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);

      // 3. Title (clean font-semibold, single line truncate)
      expect(find.text('Du Thuyền Hạ Long Heritage 5 Sao'), findsOneWidget);

      // 4. Subtitle line: "₫[amount] cho [duration] · ★ [rating]"
      expect(find.text('₫3.250.000 cho 1 đêm'), findsOneWidget);
      expect(find.text('·'), findsOneWidget);
      expect(find.byIcon(Icons.star_rounded), findsOneWidget);
      expect(find.text('4.9'), findsOneWidget);
    });

    testWidgets('AC4: Sections order check (Search -> Tour Nổi Bật -> Voucher -> Tour Mới Nhất), CategoryGrid is removed', (tester) async {
      final fakeCubit = FakeHomeDiscoveryCubit(
        const HomeDiscoveryLoaded(
          categories: testCategories,
          featuredTours: testFeaturedTours,
          latestTours: testLatestTours,
          promotions: testPromotions,
          userName: 'Minh Hoàng',
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

      // Centered 3D search bar
      expect(find.text('Bắt đầu cuộc hành trình'), findsOneWidget);

      // Tour Nổi Bật header (no fire icon)
      expect(find.text('Tour Nổi Bật'), findsOneWidget);
      expect(find.byIcon(Icons.local_fire_department_rounded), findsNothing);

      // Category Grid widget is removed as requested
      expect(find.byType(CategoryGridWidget), findsNothing);

      // Voucher banner carousel is rendered
      expect(find.byType(BannerCarouselWidget), findsOneWidget);

      // Tour Mới Nhất header
      expect(find.text('Tour Mới Nhất'), findsOneWidget);

      // Tap 'Xem tất cả' in Tour Nổi Bật navigates to TourSearchScreen
      await tester.tap(find.text('Xem tất cả').first);
      await tester.pumpAndSettle();

      expect(find.byType(TourSearchScreen), findsOneWidget);
    });

    testWidgets('AC5: NetworkErrorWidget displays error message and Thử lại button calls loadHomeData', (tester) async {
      final fakeCubit = FakeHomeDiscoveryCubit(
        const HomeDiscoveryError('Lỗi kết nối mạng máy chủ'),
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

      // Check NetworkErrorWidget
      expect(find.byType(NetworkErrorWidget), findsOneWidget);
      expect(find.text('Không thể kết nối đến máy chủ'), findsOneWidget);
      expect(find.text('Lỗi kết nối mạng máy chủ'), findsOneWidget);
      expect(find.text('Thử lại'), findsOneWidget);

      // Tap 'Thử lại'
      await tester.tap(find.text('Thử lại'));
      await tester.pump();

      expect(fakeCubit.loadHomeDataCalled, isTrue);
    });

    testWidgets('AC6: Tapping Bắt đầu cuộc hành trình opens AirbnbSearchModal with 3 Accordion blocks and full Vietnamese UI', (tester) async {
      final fakeCubit = FakeHomeDiscoveryCubit(
        const HomeDiscoveryLoaded(
          categories: testCategories,
          featuredTours: testFeaturedTours,
          latestTours: testLatestTours,
          promotions: testPromotions,
          userName: 'Minh Hoàng',
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

      // 1. Chạm vào thanh tìm kiếm "Bắt đầu cuộc hành trình"
      await tester.tap(find.text('Bắt đầu cuộc hành trình'));
      await tester.pumpAndSettle();

      // 2. Modal mở ra hiển thị nút đóng (X)
      expect(find.byIcon(Icons.close_rounded), findsOneWidget);

      // 3. Khối 1 (Điểm đến) đang mở rộng mặc định
      expect(find.text('Bạn muốn đi đâu?'), findsOneWidget);
      expect(find.text('Tìm kiếm điểm đến'), findsOneWidget);
      expect(find.text('Điểm đến gợi ý phổ biến'), findsOneWidget);
      expect(find.text('Đà Nẵng'), findsOneWidget);
      expect(find.text('Hà Nội'), findsOneWidget);

      // Nút hành động bên phải luôn luôn là "Tìm kiếm"
      expect(find.text('Tìm kiếm'), findsOneWidget);

      // 4. Khối 2 & 3 đang ở trạng thái thu gọn
      expect(find.text('Thời gian'), findsOneWidget);
      expect(find.text('Tuần bất kỳ'), findsOneWidget);
      expect(find.text('Khách'), findsOneWidget);
      expect(find.text('Thêm khách'), findsOneWidget);

      // 5. Chọn điểm đến 'Đà Nẵng' -> Khối 1 tự thu gọn và Khối 2 (Thời gian) tự mở rộng
      await tester.tap(find.text('Đà Nẵng'));
      await tester.pumpAndSettle();

      // Khối 1 giờ đã thu gọn hiển thị 'Đà Nẵng'
      expect(find.text('Đà Nẵng'), findsOneWidget);

      // Khối 2 mở rộng với 2 tab "Ngày chính xác" và "Linh hoạt"
      expect(find.text('Ngày chính xác'), findsWidgets);
      expect(find.text('Linh hoạt'), findsOneWidget);

      // Chuyển sang tab "Linh hoạt"
      await tester.tap(find.text('Linh hoạt'));
      await tester.pumpAndSettle();

      expect(find.text('Bạn muốn đi trong bao lâu?'), findsOneWidget);
      expect(find.text('Cuối tuần'), findsOneWidget);
      expect(find.text('Tuần'), findsOneWidget);
      expect(find.text('Tháng'), findsOneWidget);
      expect(find.text('Khi nào bạn muốn đi?'), findsOneWidget);

      // 6. Chạm vào Khối 3 (Khách) để mở rộng khối Khách
      await tester.ensureVisible(find.text('Khách'));
      await tester.tap(find.text('Khách'));
      await tester.pumpAndSettle();

      expect(find.text('Ai sẽ đi cùng bạn?'), findsOneWidget);
      expect(find.text('Người lớn'), findsOneWidget);
      expect(find.text('Từ 13 tuổi trở lên'), findsOneWidget);
      expect(find.text('Trẻ em'), findsOneWidget);
      expect(find.text('Độ tuổi 2–12'), findsOneWidget);
      expect(find.text('Em bé'), findsOneWidget);
      expect(find.text('Dưới 2 tuổi'), findsOneWidget);
      expect(find.text('Thú cưng'), findsOneWidget);
      expect(find.text('Mang theo thú cưng hỗ trợ?'), findsOneWidget);

      // Tăng số người lớn: bấm icon '+' đầu tiên
      await tester.ensureVisible(find.byIcon(Icons.add_rounded).first);
      await tester.tap(find.byIcon(Icons.add_rounded).first);
      await tester.pumpAndSettle();

      // Kiểm tra bộ đếm tăng lên 1
      expect(find.text('1'), findsWidgets);

      // Nút bên phải luôn luôn là "Tìm kiếm"
      expect(find.text('Tìm kiếm'), findsOneWidget);

      // Nhấn nút Tìm kiếm -> Modal đóng lại và chuyển sang TourSearchScreen
      await tester.tap(find.text('Tìm kiếm'));
      await tester.pumpAndSettle();

      expect(find.byType(TourSearchScreen), findsOneWidget);
    });
  });
}
