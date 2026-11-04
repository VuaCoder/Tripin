import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/constants/app_colors.dart';
import 'package:mobile/features/tours/models/tour_detail_model.dart';
import 'package:mobile/features/tours/screens/tour_booking_checkout_screen.dart';
import 'package:mobile/features/vouchers/models/voucher_model.dart';
import 'package:mobile/features/vouchers/screens/my_vouchers_screen.dart';
import 'package:mobile/features/vouchers/services/voucher_storage_service.dart';
import 'package:mobile/features/vouchers/widgets/voucher_bottom_sheet.dart';
import 'package:mobile/features/vouchers/widgets/voucher_ticket_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('VoucherModel Unit Tests (Shopee Rule & Calculations)', () {
    test('Calculates fixed amount discount correctly with minOrderAmount', () {
      final voucher = VoucherModel(
        id: 'v1',
        code: 'TEST50K',
        title: 'Giảm 50k',
        description: 'Đơn từ 200k',
        discountType: VoucherDiscountType.fixedAmount,
        discountValue: 50000,
        minOrderAmount: 200000,
        startsAt: DateTime.now().subtract(const Duration(days: 1)),
        endsAt: DateTime.now().add(const Duration(days: 10)),
      );

      // Đơn < 200k -> 0
      expect(voucher.calculateDiscount(150000), 0);
      expect(voucher.isEligibleForOrder(150000), false);

      // Đơn >= 200k -> 50000
      expect(voucher.calculateDiscount(500000), 50000);
      expect(voucher.isEligibleForOrder(500000), true);
    });

    test('Calculates percentage discount with maxDiscountAmount cap', () {
      final voucher = VoucherModel(
        id: 'v2',
        code: 'TEST10PCT',
        title: 'Giảm 10%',
        description: 'Tối đa 100k',
        discountType: VoucherDiscountType.percentage,
        discountValue: 10,
        maxDiscountAmount: 100000,
        minOrderAmount: 300000,
        startsAt: DateTime.now().subtract(const Duration(days: 1)),
        endsAt: DateTime.now().add(const Duration(days: 10)),
      );

      // Đơn 500k -> 10% = 50k
      expect(voucher.calculateDiscount(500000), 50000);

      // Đơn 2 triệu -> 10% = 200k nhưng cap tối đa 100k
      expect(voucher.calculateDiscount(2000000), 100000);
    });

    test('Shopee single-use rule: Used voucher returns 0 discount and is not available', () {
      final voucher = VoucherModel(
        id: 'v3',
        code: 'ONCEONLY',
        title: 'Chỉ dùng 1 lần',
        description: '',
        discountType: VoucherDiscountType.fixedAmount,
        discountValue: 100000,
        minOrderAmount: 0,
        startsAt: DateTime.now().subtract(const Duration(days: 1)),
        endsAt: DateTime.now().add(const Duration(days: 10)),
        isUsed: true,
      );

      expect(voucher.isAvailable, false);
      expect(voucher.status, VoucherStatus.used);
      expect(voucher.calculateDiscount(1000000), 0);
    });
  });

  group('VoucherStorageService Tests', () {
    test('Default vouchers initialize and markAsUsed updates state', () async {
      SharedPreferences.setMockInitialValues({});
      final service = VoucherStorageService();

      final initial = await service.getAvailableVouchers();
      expect(initial.isNotEmpty, true);
      final firstVoucher = initial.first;

      // Đánh dấu đã dùng cho đơn đặt tour
      await service.markVoucherAsUsed(firstVoucher.id, bookingId: 'BK-TEST-123');

      final availableAfter = await service.getAvailableVouchers();
      final usedList = await service.getUsedVouchers();

      expect(availableAfter.any((v) => v.id == firstVoucher.id), false);
      expect(usedList.any((v) => v.id == firstVoucher.id && v.isUsed), true);
    });
  });

  group('Voucher UI & MyVouchersScreen Tests', () {
    testWidgets('Renders MyVouchersScreen with 3 tabs (Khả dụng, Đã dùng, Hết hạn)', (tester) async {
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(
        const MaterialApp(
          home: MyVouchersScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Ưu đãi & Voucher của tôi'), findsOneWidget);
      expect(find.textContaining('Khả dụng'), findsOneWidget);
      expect(find.textContaining('Đã dùng'), findsOneWidget);
      expect(find.textContaining('Hết hạn'), findsOneWidget);
      expect(find.text('Lưu mã'), findsOneWidget);
    });

    testWidgets('VoucherTicketCard renders discount value and code correctly', (tester) async {
      final voucher = VoucherModel(
        id: 'card_v1',
        code: 'PROMO50',
        title: 'Giảm 50.000đ khi đặt tour',
        description: 'Áp dụng cho mọi tour',
        discountType: VoucherDiscountType.fixedAmount,
        discountValue: 50000,
        minOrderAmount: 100000,
        startsAt: DateTime.now().subtract(const Duration(days: 1)),
        endsAt: DateTime.now().add(const Duration(days: 5)),
        badgeText: 'HOT',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VoucherTicketCard(
              voucher: voucher,
              isSelectable: true,
              currentOrderTotal: 300000,
            ),
          ),
        ),
      );

      expect(find.text('50K'), findsOneWidget);
      expect(find.text('PROMO50'), findsOneWidget);
      expect(find.text('HOT'), findsOneWidget);
      expect(find.text('Áp dụng'), findsOneWidget);
    });

    testWidgets('VoucherTicketCard renders "Điều kiện" button instead of "Dùng ngay" and opens VoucherDetailBottomSheet', (tester) async {
      bool useNowCalled = false;
      final voucher = VoucherModel(
        id: 'card_v2',
        code: 'TRIPRI50K',
        title: 'Giảm 50.000đ cho chuyến đi đầu tiên',
        description: 'Áp dụng cho mọi tour trải nghiệm bản địa từ 200.000đ',
        discountType: VoucherDiscountType.fixedAmount,
        discountValue: 50000,
        minOrderAmount: 200000,
        startsAt: DateTime.now().subtract(const Duration(days: 1)),
        endsAt: DateTime.now().add(const Duration(days: 10)),
        badgeText: 'Khách mới',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VoucherTicketCard(
              voucher: voucher,
              isSelectable: false,
              onUseNow: () {
                useNowCalled = true;
              },
            ),
          ),
        ),
      );

      // Nút "Điều kiện" hiển thị thay vì "Dùng ngay" trực tiếp trên card
      expect(find.text('Điều kiện'), findsOneWidget);
      expect(find.text('Dùng ngay'), findsNothing);

      // Bấm vào nút "Điều kiện" để mở modal bảng chi tiết
      await tester.tap(find.text('Điều kiện'));
      await tester.pumpAndSettle();

      // Kiểm tra modal chi tiết theo chuẩn Shopee & Grab Voucher
      expect(find.text('Điều kiện sử dụng Voucher'), findsOneWidget);
      expect(find.text('TRIPRI50K'), findsWidgets);
      expect(find.text('Sao chép'), findsOneWidget);
      expect(find.text('Mức giảm giá'), findsOneWidget);

      // Nút "Dùng ngay" nằm cố định ở bottom action bar
      expect(find.text('Dùng ngay'), findsOneWidget);

      // Cuộn để thấy điều khoản chi tiết
      await tester.scrollUntilVisible(find.text('QUY ĐỊNH VÀ ĐIỀU KHOẢN KHÁC'), 200);
      expect(find.text('QUY ĐỊNH VÀ ĐIỀU KHOẢN KHÁC'), findsOneWidget);

      // Bấm nút "Dùng ngay" trong modal
      await tester.tap(find.text('Dùng ngay'));
      await tester.pumpAndSettle();

      expect(useNowCalled, isTrue);
    });
  });

  group('TourBookingCheckoutScreen 3-Step Flow with Voucher Tests', () {
    final sampleTour = TourDetailModel(
      id: 'tour_test_123',
      title: 'Tour Khám Phá Vịnh Hạ Long',
      summary: 'Trải nghiệm du thuyền',
      description: 'Mô tả chi tiết',
      destination: 'Quảng Ninh',
      categoryIds: const ['cat_1'],
      coverImage: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482',
      images: const ['https://images.unsplash.com/photo-1583417319070-4a69db38a482'],
      durationDays: 2,
      basePrice: 1000000,
      ratingAvg: 4.9,
      ratingCount: 15,
      departures: [
        TourDepartureModel(
          id: 'dep_test_1',
          date: DateTime(2026, 12, 1),
          capacity: 20,
          remaining: 10,
          price: 1000000,
          isOpen: true,
        ),
      ],
    );

    testWidgets('Step 1: Displays Voucher button beneath Total Price and navigates to Step 2 & 3', (tester) async {
      SharedPreferences.setMockInitialValues({});

      await tester.pumpWidget(
        MaterialApp(
          home: TourBookingCheckoutScreen(
            tour: sampleTour,
            initialDeparture: sampleTour.departures.first,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Step 1: Kiểm tra và tiếp tục
      expect(find.text('Kiểm tra và tiếp tục'), findsOneWidget);
      expect(find.text('Ưu đãi & Voucher'), findsOneWidget);
      expect(find.text('Chọn hoặc nhập mã giảm giá'), findsOneWidget);

      // Bấm nút "Tiếp tục" chuyển sang Bước 2 (Phương thức thanh toán)
      final continueBtn = find.text('Tiếp tục');
      expect(continueBtn, findsOneWidget);
      await tester.tap(continueBtn);
      await tester.pumpAndSettle();

      // Step 2: Phương thức thanh toán (chỉ có PayOS theo yêu cầu)
      expect(find.text('Phương thức thanh toán'), findsOneWidget);
      expect(find.text('Cổng thanh toán PayOS'), findsOneWidget);

      // Bấm nút "Tiếp tục" ở bước 2 chuyển sang Bước 3 (Màn hình tổng thể cuối cùng)
      await tester.tap(find.text('Tiếp tục'));
      await tester.pumpAndSettle();

      // Step 3: Xác nhận đơn đặt tour với tất cả thông tin & các nút Thay đổi
      expect(find.text('Xác nhận đơn đặt tour'), findsOneWidget);
      expect(find.text('Chuyến đi của bạn'), findsOneWidget);
      expect(find.text('Thông tin liên hệ'), findsOneWidget);
      expect(find.text('Ưu đãi & Voucher'), findsOneWidget);
      expect(find.text('Phương thức thanh toán'), findsOneWidget);
      expect(find.text('Chi tiết thanh toán'), findsOneWidget);

      // Kiểm tra có các nút Thay đổi trực tiếp trên màn hình tổng thể
      expect(find.text('Thay đổi'), findsWidgets);

      // Nút thanh toán cuối cùng
      expect(find.textContaining('Thanh toán ngay'), findsOneWidget);
    });
  });
}
