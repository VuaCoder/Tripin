import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/forgot_password_request.dart';
import 'forgot_password_event.dart';
import 'forgot_password_state.dart';

class ForgotPasswordBloc extends Bloc<ForgotPasswordEvent, ForgotPasswordState> {
  final ApiClient apiClient;

  ForgotPasswordBloc({ApiClient? client})
      : apiClient = client ?? ApiClient(),
        super(const ForgotPasswordInitial()) {
    on<ForgotPasswordSubmitted>(_onForgotPasswordSubmitted);
    on<ResetPasswordSubmitted>(_onResetPasswordSubmitted);
  }

  Future<void> _onForgotPasswordSubmitted(
    ForgotPasswordSubmitted event,
    Emitter<ForgotPasswordState> emit,
  ) async {
    emit(const ForgotPasswordLoading());
    try {
      final request = ForgotPasswordRequest(email: event.email);
      final response = await apiClient.post(
        ApiEndpoints.forgotPassword,
        data: request.toJson(),
      );

      if (response.statusCode != null && response.statusCode! < 400) {
        emit(ForgotPasswordOtpSent(
          email: event.email.trim(),
          message: 'Mã xác nhận OTP đã được gửi đến email của bạn!',
        ));
      } else {
        emit(const ForgotPasswordFailure('Không thể gửi mã xác nhận, vui lòng thử lại'));
      }
    } on DioException catch (e) {
      final resData = e.response?.data;
      String message = 'Yêu cầu đặt lại mật khẩu thất bại';

      if (resData is Map<String, dynamic>) {
        final rawMsg = resData['message'] as String?;
        if (rawMsg != null && rawMsg.isNotEmpty) {
          message = rawMsg;
        }
      }
      emit(ForgotPasswordFailure(message));
    } catch (e) {
      emit(ForgotPasswordFailure(e.toString()));
    }
  }

  Future<void> _onResetPasswordSubmitted(
    ResetPasswordSubmitted event,
    Emitter<ForgotPasswordState> emit,
  ) async {
    emit(const ForgotPasswordLoading());
    try {
      final request = ResetPasswordRequest(
        email: event.email,
        code: event.code,
        newPassword: event.newPassword,
      );

      final response = await apiClient.post(
        ApiEndpoints.resetPassword,
        data: request.toJson(),
      );

      if (response.statusCode != null && response.statusCode! < 400) {
        emit(const ResetPasswordSuccess('Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.'));
      } else {
        emit(const ForgotPasswordFailure('Đặt lại mật khẩu thất bại'));
      }
    } on DioException catch (e) {
      final resData = e.response?.data;
      String message = 'Đặt lại mật khẩu thất bại';

      if (resData is Map<String, dynamic>) {
        final code = resData['code'] as String?;
        final rawMsg = resData['message'] as String?;

        if (code == 'INVALID_OTP') {
          message = 'Mã OTP không chính xác, vui lòng kiểm tra lại';
        } else if (code == 'EXPIRED_OTP') {
          message = 'Mã OTP đã hết hạn, vui lòng gửi lại mã mới';
        } else if (rawMsg != null && rawMsg.isNotEmpty) {
          message = rawMsg;
        }
      }
      emit(ForgotPasswordFailure(message));
    } catch (e) {
      emit(ForgotPasswordFailure(e.toString()));
    }
  }
}