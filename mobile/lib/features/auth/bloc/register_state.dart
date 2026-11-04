import 'package:equatable/equatable.dart';

abstract class RegisterState extends Equatable {
  const RegisterState();

  @override
  List<Object?> get props => [];
}

class RegisterInitial extends RegisterState {
  const RegisterInitial();
}

class RegisterLoading extends RegisterState {
  const RegisterLoading();
}

class RegisterSuccess extends RegisterState {
  final String email;
  final String role;
  final String message;

  const RegisterSuccess({
    required this.email,
    required this.role,
    required this.message,
  });

  @override
  List<Object?> get props => [email, role, message];
}

class RegisterFailure extends RegisterState {
  final String errorMessage;

  const RegisterFailure(this.errorMessage);

  @override
  List<Object?> get props => [errorMessage];
}
