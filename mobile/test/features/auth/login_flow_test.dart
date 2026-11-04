import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/bloc/login_bloc.dart';
import 'package:mobile/features/auth/bloc/login_event.dart';
import 'package:mobile/features/auth/models/forgot_password_request.dart';
import 'package:mobile/features/auth/models/login_request.dart';
import 'package:mobile/features/auth/screens/login_screen.dart';
import 'package:mobile/features/auth/widgets/google_sign_in_button.dart';

void main() {
  group('[FLOW-02] Login & Forgot Password Models Unit Tests', () {
    test('LoginRequest formats email to lowercase and trims whitespace', () {
      const req = LoginRequest(email: '  Traveler@Tripri.VN  ', password: 'Password123');
      final json = req.toJson();
      expect(json['email'], 'traveler@tripri.vn');
      expect(json['password'], 'Password123');
    });

    test('ForgotPasswordRequest & ResetPasswordRequest serialize properly', () {
      const fpReq = ForgotPasswordRequest(email: ' User@Test.Com ');
      expect(fpReq.toJson()['email'], 'user@test.com');

      const resetReq = ResetPasswordRequest(
        email: 'User@Test.Com',
        code: ' 123456 ',
        newPassword: 'NewSecurePass@123',
      );
      final json = resetReq.toJson();
      expect(json['email'], 'user@test.com');
      expect(json['code'], '123456');
      expect(json['newPassword'], 'NewSecurePass@123');
    });
  });

  group('[FLOW-02] LoginScreen Widget Tests', () {
    testWidgets('renders all required elements: email, password, buttons and links', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider(
            create: (_) => LoginBloc(),
            child: const LoginScreen(),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Đăng nhập'), findsAtLeastNWidgets(1));
      expect(find.text('Địa chỉ Email'), findsOneWidget);
      expect(find.text('Mật khẩu'), findsOneWidget);
      expect(find.text('Quên mật khẩu?'), findsOneWidget);
      expect(find.text('Đăng nhập bằng Google'), findsOneWidget);
      expect(find.text('Chưa có tài khoản? '), findsOneWidget);
      expect(find.text('Đăng ký ngay'), findsOneWidget);
    });

    testWidgets('renders with prefillEmail after successful registration without missing provider error', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider(
            create: (_) => LoginBloc(),
            child: const LoginScreen(prefillEmail: 'traveler@test.com'),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('traveler@test.com'), findsOneWidget);
      expect(find.text('Đăng nhập'), findsAtLeastNWidgets(1));
    });
  });

  group('[FLOW-02] GoogleSignInButton Widget Tests', () {
    testWidgets('renders GoogleLogoIcon and custom text', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: GoogleSignInButton(
              text: 'Đăng nhập bằng Google',
              onPressed: () {},
            ),
          ),
        ),
      );

      expect(find.text('Đăng nhập bằng Google'), findsOneWidget);
      expect(find.byType(GoogleLogoIcon), findsOneWidget);
    });

    testWidgets('renders loading state when isLoading is true', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GoogleSignInButton(
              text: 'Đăng ký bằng Google',
              isLoading: true,
            ),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });

  group('[FLOW-02] LoginWithGoogleSubmitted Event Tests', () {
    test('LoginWithGoogleSubmitted props formats role and mockIdToken', () {
      const event = LoginWithGoogleSubmitted(role: 'TRAVELER', mockIdToken: 'fake-token-123');
      expect(event.role, 'TRAVELER');
      expect(event.mockIdToken, 'fake-token-123');
      expect(event.props, ['TRAVELER', 'fake-token-123']);
    });
  });
}