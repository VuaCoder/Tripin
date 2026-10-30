import 'package:equatable/equatable.dart';

class OtpState extends Equatable {
  final int remainingSeconds;
  final bool isSubmitting;
  final bool isResending;
  final bool isSuccess;
  final String? successMessage;
  final String? errorMessage;
  final String? lastResentMessage;
  final String? userRole;
  final String? userName;

  const OtpState({
    this.remainingSeconds = 60,
    this.isSubmitting = false,
    this.isResending = false,
    this.isSuccess = false,
    this.successMessage,
    this.errorMessage,
    this.lastResentMessage,
    this.userRole,
    this.userName,
  });

  bool get canResend => remainingSeconds <= 0 && !isResending && !isSubmitting;

  OtpState copyWith({
    int? remainingSeconds,
    bool? isSubmitting,
    bool? isResending,
    bool? isSuccess,
    String? successMessage,
    String? errorMessage,
    String? lastResentMessage,
    String? userRole,
    String? userName,
    bool clearError = false,
  }) {
    return OtpState(
      remainingSeconds: remainingSeconds ?? this.remainingSeconds,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isResending: isResending ?? this.isResending,
      isSuccess: isSuccess ?? this.isSuccess,
      successMessage: successMessage ?? this.successMessage,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      lastResentMessage: lastResentMessage ?? this.lastResentMessage,
      userRole: userRole ?? this.userRole,
      userName: userName ?? this.userName,
    );
  }

  @override
  List<Object?> get props => [
        remainingSeconds,
        isSubmitting,
        isResending,
        isSuccess,
        successMessage,
        errorMessage,
        lastResentMessage,
        userRole,
        userName,
      ];
}
