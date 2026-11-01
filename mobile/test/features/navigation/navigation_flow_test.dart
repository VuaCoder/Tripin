import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/constants/app_colors.dart';
import 'package:mobile/features/navigation/traveler_main_navigation_screen.dart';

void main() {
  group('TravelerMainNavigationScreen Widget Tests', () {
    testWidgets('renders 5 tabs: Khám phá, Yêu thích, Chuyến đi, Tin nhắn, Tài khoản with sticky search', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: TravelerMainNavigationScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Check all 5 tabs exist in correct order
      expect(find.text('Khám phá'), findsOneWidget);
      expect(find.text('Yêu thích'), findsOneWidget);
      expect(find.text('Chuyến đi'), findsOneWidget);
      expect(find.text('Tin nhắn'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);

      // Verify sticky search bar is rendered on Khám phá
      expect(find.text('Bắt đầu cuộc hành trình'), findsOneWidget);

      // Verify active tab (Khám phá at index 0) has primary brand color
      final activeText = tester.widget<Text>(find.text('Khám phá'));
      expect(activeText.style?.color, AppColors.primary);

      // Verify inactive tab has text color #64748B
      final inactiveText = tester.widget<Text>(find.text('Yêu thích'));
      expect(inactiveText.style?.color, const Color(0xFF64748B));

      // Tap on "Chuyến đi"
      await tester.tap(find.widgetWithText(InkWell, 'Chuyến đi'));
      await tester.pumpAndSettle();

      // Verify "Chuyến đi" tab is now active with primary color
      final tripNavText = tester.widget<Text>(
        find.descendant(
          of: find.widgetWithText(InkWell, 'Chuyến đi'),
          matching: find.text('Chuyến đi'),
        ),
      );
      expect(tripNavText.style?.color, AppColors.primary);

      // Verify "Khám phá" is now inactive
      final oldActiveText = tester.widget<Text>(find.text('Khám phá'));
      expect(oldActiveText.style?.color, const Color(0xFF64748B));

      // Verify navigated page content
      expect(find.widgetWithText(AppBar, 'Chuyến đi'), findsOneWidget);
    });
  });
}
