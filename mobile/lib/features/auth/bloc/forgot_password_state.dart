import 'package:equatable/equatable.dart';

abstract class ForgotPasswordState extends Equatable {
  const ForgotPasswordState();

  @override
  List<Object?> get props => [];
}

class ForgotPasswordInitial extends ForgotPasswordState {
  const ForgotPasswordInitial();
}

class ForgotPasswordLoading extends ForgotPasswordState {
  const ForgotPasswordLoading();
}

class ForgotPasswordOtpSent extends ForgotPasswordState {
  final String email;
  final String message;

  const ForgotPasswordOtpSent({required this.email, required this.message});

  @override
  List<Object?> get props => [email, message];
}

class ResetPasswordSuccess extends ForgotPasswordState {
  final String message;

  const ResetPasswordSuccess(this.message);

  @override
  List<Object?> get props => [message];
}

class ForgotPasswordFailure extends ForgotPasswordState {
  final String error;

  const ForgotPasswordFailure(this.error);

  @override
  List<Object?> get props => [error];
}