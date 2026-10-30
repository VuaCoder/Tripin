import 'package:equatable/equatable.dart';

abstract class LoginEvent extends Equatable {
  const LoginEvent();

  @override
  List<Object?> get props => [];
}

class LoginSubmitted extends LoginEvent {
  final String email;
  final String password;

  const LoginSubmitted({required this.email, required this.password});

  @override
  List<Object?> get props => [email, password];
}

class LoginWithGoogleSubmitted extends LoginEvent {
  final String? role;
  final String? mockIdToken;

  const LoginWithGoogleSubmitted({this.role, this.mockIdToken});

  @override
  List<Object?> get props => [role, mockIdToken];
}