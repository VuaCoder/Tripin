import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/bloc/login_bloc.dart';
import 'package:mobile/features/auth/models/forgot_password_request.dart';
import 'package:mobile/features/auth/models/login_request.dart';
import 'package:mobile/features/auth/screens/login_screen.dart';

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
      expect(find.text('Chưa có tài khoản? '), findsOneWidget);
      expect(find.text('Đăng ký ngay'), findsOneWidget);
    });
  });
}