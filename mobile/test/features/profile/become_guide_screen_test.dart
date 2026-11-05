import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/models/user_profile_model.dart';
import 'package:mobile/features/profile/screens/become_guide_screen.dart';

void main() {
  group('BecomeGuideScreen Widget Tests', () {
    final traveler = UserProfileModel(
      id: 'traveler-1',
      email: 'traveler@tripri.test',
      fullName: 'Hoàng Phúc',
      phone: '0912345678',
      role: 'TRAVELER',
    );

    testWidgets('renders registration form for traveler with Steps indicator and step 0 fields', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BecomeGuideScreen(user: traveler, initialStatus: 'NOT_SUBMITTED'),
        ),
      );
      await tester.pumpAndSettle();

      // Custom header
      expect(find.text('Trở thành Hướng dẫn viên'), findsWidgets);

      // Steps Indicator labeled stages
      expect(find.text('Cá nhân'), findsOneWidget);
      expect(find.text('Giấy phép'), findsOneWidget);
      expect(find.text('Chuyên môn'), findsOneWidget);
      expect(find.text('Xem lại'), findsOneWidget);

      // Step 0 content
      expect(find.text('1. Thông tin cá nhân'), findsOneWidget);
      expect(find.text('Giới thiệu bản thân & cam kết dịch vụ'), findsOneWidget);
      expect(find.text('Tiếp tục'), findsOneWidget);
    });

    testWidgets('navigates through steps and enters license number in step 1', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BecomeGuideScreen(user: traveler, initialStatus: 'NOT_SUBMITTED'),
        ),
      );
      await tester.pumpAndSettle();

      // Tap "Tiếp tục" from Step 0 to Step 1
      await tester.tap(find.text('Tiếp tục'));
      await tester.pumpAndSettle();

      // Now at Step 1: Giấy phép & Kinh nghiệm
      expect(find.text('2. Giấy phép & Kinh nghiệm'), findsOneWidget);
      expect(find.text('Quay lại'), findsOneWidget);

      final licenseField = find.byType(TextFormField).first;
      await tester.enterText(licenseField, '10118-HDVQT-8899');
      await tester.pumpAndSettle();

      expect(find.text('10118-HDVQT-8899'), findsOneWidget);
    });

    testWidgets('renders real-time pending view with simulation buttons when status is PENDING', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BecomeGuideScreen(user: traveler, initialStatus: 'PENDING'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Hồ sơ đang được xét duyệt'), findsOneWidget);
      expect(find.text('ĐANG THEO DÕI THỜI GIAN THỰC'), findsOneWidget);
      expect(find.text('KIỂM THỬ THỜI GIAN THỰC (ADMIN / DEV)'), findsOneWidget);
      expect(find.text('Phê duyệt (Duyệt thật)'), findsOneWidget);
      expect(find.text('Từ chối'), findsOneWidget);
    });

    testWidgets('renders approved view when status is APPROVED', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BecomeGuideScreen(user: traveler, initialStatus: 'APPROVED'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Chúc mừng bạn!'), findsOneWidget);
      expect(find.text('Truy cập hồ sơ Hướng dẫn viên'), findsOneWidget);
    });

    testWidgets('renders rejected view when status is REJECTED', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BecomeGuideScreen(user: traveler, initialStatus: 'REJECTED'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Hồ sơ chưa được phê duyệt'), findsOneWidget);
      expect(find.text('Chỉnh sửa & Gửi lại hồ sơ'), findsOneWidget);
    });
  });
}
