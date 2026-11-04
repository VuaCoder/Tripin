import 'package:equatable/equatable.dart';
import '../models/register_request.dart';

abstract class RegisterEvent extends Equatable {
  const RegisterEvent();

  @override
  List<Object?> get props => [];
}

class RegisterSubmitted extends RegisterEvent {
  final RegisterRequest request;

  const RegisterSubmitted(this.request);

  @override
  List<Object?> get props => [request];
}

class RegisterReset extends RegisterEvent {
  const RegisterReset();
}
