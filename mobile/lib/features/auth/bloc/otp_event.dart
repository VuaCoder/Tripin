import 'package:equatable/equatable.dart';

abstract class OtpEvent extends Equatable {
  const OtpEvent();

  @override
  List<Object?> get props => [];
}

class OtpStarted extends OtpEvent {
  final int duration;
  const OtpStarted({this.duration = 60});

  @override
  List<Object?> get props => [duration];
}

class OtpSubmitted extends OtpEvent {
  final String email;
  final String code;
  final String purpose;

  const OtpSubmitted({
    required this.email,
    required this.code,
    this.purpose = 'REGISTER',
  });

  @override
  List<Object?> get props => [email, code, purpose];
}

class OtpResendRequested extends OtpEvent {
  final String email;
  final String purpose;

  const OtpResendRequested({
    required this.email,
    this.purpose = 'REGISTER',
  });

  @override
  List<Object?> get props => [email, purpose];
}

class OtpTimerTicked extends OtpEvent {
  final int remainingSeconds;

  const OtpTimerTicked(this.remainingSeconds);

  @override
  List<Object?> get props => [remainingSeconds];
}
