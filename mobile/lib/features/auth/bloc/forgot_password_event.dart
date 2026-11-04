import 'package:equatable/equatable.dart';

abstract class ForgotPasswordEvent extends Equatable {
  const ForgotPasswordEvent();

  @override
  List<Object?> get props => [];
}

class ForgotPasswordSubmitted extends ForgotPasswordEvent {
  final String email;

  const ForgotPasswordSubmitted(this.email);

  @override
  List<Object?> get props => [email];
}

class ResetPasswordSubmitted extends ForgotPasswordEvent {
  final String email;
  final String code;
  final String newPassword;

  const ResetPasswordSubmitted({
    required this.email,
    required this.code,
    required this.newPassword,
  });

  @override
  List<Object?> get props => [email, code, newPassword];
}