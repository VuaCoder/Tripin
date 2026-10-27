import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/models/register_request.dart';
import 'package:mobile/features/auth/models/verify_otp_request.dart';
import 'package:mobile/features/auth/widgets/password_strength_bar.dart';
import 'package:mobile/features/auth/widgets/otp_input_field.dart';
import 'package:mobile/features/auth/screens/welcome_auth_screen.dart';

void main() {
  group('[FLOW-01] Models Unit Tests', () {
    test('RegisterRequest formats correctly for Traveler and Tour Guide', () {
      final travelerReq = RegisterRequest(
        email: 'TRAVELER@TEST.COM',
        password: 'Password123',
        fullName: 'Nguyen Van An',
        phone: '0901234567',
        role: 'TRAVELER',
      );

      final travelerJson = travelerReq.toJson();
      expect(travelerJson['email'], 'traveler@test.com');
      expect(travelerJson['role'], 'TRAVELER');
      expect(travelerJson['fullName'], 'Nguyen Van An');
      expect(travelerJson['phone'], '0901234567');

      final guideReq = RegisterRequest(
        email: 'guide@test.com',
        password: 'Password123',
        fullName: 'Le Van Guide',
        role: 'TOUR_GUIDE',
      );

      final guideJson = guideReq.toJson();
      expect(guideJson['role'], 'TOUR_GUIDE');
      expect(guideJson.containsKey('phone'), isFalse);
    });

    test('VerifyOtpRequest formats code and purpose correctly', () {
      const otpReq = VerifyOtpRequest(
        email: 'USER@TEST.COM',
        code: '123456',
        purpose: 'REGISTER',
      );

      final json = otpReq.toJson();
      expect(json['email'], 'user@test.com');
      expect(json['code'], '123456');
      expect(json['purpose'], 'REGISTER');
    });
  });

  group('[FLOW-01] PasswordStrengthBar Unit & Widget Tests (AC1)', () {
    test('Strength calculation tests', () {
      const barEmpty = PasswordStrengthBar(password: '');
      expect(barEmpty.strength, PasswordStrength.none);

      const barShort = PasswordStrengthBar(password: 'pass');
      expect(barShort.strength, PasswordStrength.weak);

      const barMedium = PasswordStrengthBar(password: 'Password123');
      expect(barMedium.strength, PasswordStrength.medium);

      const barStrong = PasswordStrengthBar(password: 'Password123!@#');
      expect(barStrong.strength, PasswordStrength.strong);
    });

    testWidgets('renders strength text when password is typed', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: PasswordStrengthBar(password: 'Password123'),
          ),
        ),
      );

      expect(find.text('Mật khẩu trung bình'), findsOneWidget);
    });
  });

  group('[FLOW-01] OtpInputField Widget Tests (AC3)', () {
    testWidgets('renders 6 input boxes', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpInputField(
              length: 6,
              onCompleted: (_) {},
            ),
          ),
        ),
      );

      // Verify 6 TextFields are rendered
      expect(find.byType(TextField), findsNWidgets(6));
    });
  });

  group('[FLOW-01] WelcomeAuthScreen Navigation Widget Tests', () {
    testWidgets('renders 2 distinct registration options', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: WelcomeAuthScreen(),
        ),
      );

      expect(find.text('Tripri Travel'), findsOneWidget);
      expect(find.text('Đăng ký Khách du lịch'), findsOneWidget);
      expect(find.text('Trở thành Hướng dẫn viên'), findsOneWidget);
    });
  });
}
