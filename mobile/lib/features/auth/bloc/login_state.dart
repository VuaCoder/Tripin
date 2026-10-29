import 'package:equatable/equatable.dart';

abstract class LoginState extends Equatable {
  const LoginState();

  @override
  List<Object?> get props => [];
}

class LoginInitial extends LoginState {
  const LoginInitial();
}

class LoginLoading extends LoginState {
  const LoginLoading();
}

class LoginSuccess extends LoginState {
  final String role;
  final String fullName;

  const LoginSuccess({required this.role, required this.fullName});

  @override
  List<Object?> get props => [role, fullName];
}

class LoginRequiresOtp extends LoginState {
  final String email;
  final String message;

  const LoginRequiresOtp({
    required this.email,
    this.message = 'Tài khoản chưa kích hoạt. Mã OTP đã được gửi về email của bạn.',
  });

  @override
  List<Object?> get props => [email, message];
}

class LoginFailure extends LoginState {
  final String error;

  const LoginFailure(this.error);

  @override
  List<Object?> get props => [error];
}