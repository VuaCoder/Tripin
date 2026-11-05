import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../models/verify_otp_request.dart';
import 'otp_event.dart';
import 'otp_state.dart';

class OtpBloc extends Bloc<OtpEvent, OtpState> {
  final ApiClient apiClient;
  final TokenStorage tokenStorage;
  StreamSubscription<int>? _timerSubscription;

  OtpBloc({
    ApiClient? client,
    TokenStorage? storage,
  })  : apiClient = client ?? ApiClient(),
        tokenStorage = storage ?? TokenStorage(),
        super(const OtpState()) {
    on<OtpStarted>(_onOtpStarted);
    on<OtpTimerTicked>(_onOtpTimerTicked);
    on<OtpSubmitted>(_onOtpSubmitted);
    on<OtpResendRequested>(_onOtpResendRequested);
  }

  void _startTimer(int seconds) {
    _timerSubscription?.cancel();
    _timerSubscription = Stream.periodic(
      const Duration(seconds: 1),
      (x) => seconds - x - 1,
    ).take(seconds).listen((remaining) {
      add(OtpTimerTicked(remaining));
    });
  }

  void _onOtpStarted(OtpStarted event, Emitter<OtpState> emit) {
    emit(state.copyWith(remainingSeconds: event.duration, clearError: true));
    _startTimer(event.duration);
  }

  void _onOtpTimerTicked(OtpTimerTicked event, Emitter<OtpState> emit) {
    emit(state.copyWith(remainingSeconds: event.remainingSeconds));
  }

  Future<void> _onOtpSubmitted(
    OtpSubmitted event,
    Emitter<OtpState> emit,
  ) async {
    emit(state.copyWith(isSubmitting: true, clearError: true));

    try {
      final request = VerifyOtpRequest(
        email: event.email,
        code: event.code,
        purpose: event.purpose,
      );

      final response = await apiClient.post(
        ApiEndpoints.verifyOtp,
        data: request.toJson(),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        String userRole = 'TRAVELER';
        String userName = 'Người dùng Tripri';

        if (data is Map) {
          final payload = data['data'] is Map ? data['data'] as Map : data;
          final accessToken = payload['accessToken']?.toString();
          final refreshToken = payload['refreshToken']?.toString();
          final user = payload['user'] is Map ? payload['user'] as Map : null;

          if (user != null) {
            userRole = user['role']?.toString() ?? userRole;
            userName = user['fullName']?.toString() ?? userName;

            await tokenStorage.saveUserInfo(
              id: user['id']?.toString() ?? '',
              email: user['email']?.toString() ?? event.email,
              name: userName,
              role: userRole,
            );
          }

          if (accessToken != null && accessToken.isNotEmpty) {
            await tokenStorage.saveTokens(
              accessToken: accessToken,
              refreshToken: refreshToken ?? '',
            );
          }
        }

        emit(state.copyWith(
          isSubmitting: false,
          isSuccess: true,
          userRole: userRole,
          userName: userName,
          successMessage: 'Xác thực OTP thành công!',
        ));
      } else {
        emit(state.copyWith(
          isSubmitting: false,
          errorMessage: 'Mã xác thực không hợp lệ. Vui lòng kiểm tra lại.',
        ));
      }
    } on DioException catch (dioErr) {
      String message = 'Xác thực OTP thất bại. Vui lòng thử lại.';

      if (dioErr.response?.data is Map) {
        final data = dioErr.response!.data as Map;
        final errorObj = data['error'] is Map ? data['error'] as Map : null;
        final code = errorObj?['code']?.toString() ?? data['code']?.toString();
        final msg = errorObj?['message']?.toString() ?? data['message']?.toString();

        if (code == 'INVALID_OTP' || (msg != null && msg.toLowerCase().contains('invalid'))) {
          message = 'Mã OTP không chính xác. Vui lòng nhập lại.';
        } else if (code == 'EXPIRED_OTP' || (msg != null && msg.toLowerCase().contains('expired'))) {
          message = 'Mã OTP đã hết hạn. Vui lòng bấm "Gửi lại mã".';
        } else if (msg != null && msg.isNotEmpty) {
          message = msg;
        }
      } else if (dioErr.type == DioExceptionType.connectionTimeout) {
        message = 'Hết thời gian kết nối. Vui lòng thử lại.';
      }

      emit(state.copyWith(
        isSubmitting: false,
        errorMessage: message,
      ));
    } catch (e) {
      emit(state.copyWith(
        isSubmitting: false,
        errorMessage: 'Lỗi không xác định: $e',
      ));
    }
  }

  Future<void> _onOtpResendRequested(
    OtpResendRequested event,
    Emitter<OtpState> emit,
  ) async {
    if (!state.canResend) return;

    emit(state.copyWith(isResending: true, clearError: true));

    try {
      final response = await apiClient.post(
        ApiEndpoints.resendOtp,
        data: {
          'email': event.email.trim().toLowerCase(),
          'purpose': event.purpose,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        emit(state.copyWith(
          isResending: false,
          remainingSeconds: 60,
          lastResentMessage: 'Mã OTP mới đã được gửi về email của bạn!',
        ));
        _startTimer(60);
      } else {
        emit(state.copyWith(
          isResending: false,
          errorMessage: 'Gửi lại mã không thành công. Vui lòng thử lại sau.',
        ));
      }
    } on DioException catch (dioErr) {
      String message = 'Không thể gửi lại mã OTP. Vui lòng thử lại.';
      if (dioErr.response?.data is Map) {
        final data = dioErr.response!.data as Map;
        final msg = data['message']?.toString();
        if (msg != null && msg.isNotEmpty) message = msg;
      }
      emit(state.copyWith(
        isResending: false,
        errorMessage: message,
      ));
    } catch (e) {
      emit(state.copyWith(
        isResending: false,
        errorMessage: 'Lỗi gửi lại mã: $e',
      ));
    }
  }

  @override
  Future<void> close() {
    _timerSubscription?.cancel();
    return super.close();
  }
}
