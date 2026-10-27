import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import 'register_event.dart';
import 'register_state.dart';

class RegisterBloc extends Bloc<RegisterEvent, RegisterState> {
  final ApiClient apiClient;

  RegisterBloc({ApiClient? client})
      : apiClient = client ?? ApiClient(),
        super(const RegisterInitial()) {
    on<RegisterSubmitted>(_onRegisterSubmitted);
    on<RegisterReset>((event, emit) => emit(const RegisterInitial()));
  }

  Future<void> _onRegisterSubmitted(
    RegisterSubmitted event,
    Emitter<RegisterState> emit,
  ) async {
    emit(const RegisterLoading());

    try {
      final response = await apiClient.post(
        ApiEndpoints.register,
        data: event.request.toJson(),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = response.data;
        final message = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'Đăng ký thành công! Mã OTP xác thực đã được gửi về email.';

        emit(RegisterSuccess(
          email: event.request.email,
          role: event.request.role,
          message: message,
        ));
      } else {
        emit(const RegisterFailure('Đăng ký không thành công. Vui lòng thử lại.'));
      }
    } on DioException catch (dioErr) {
      String errorMessage = 'Lỗi kết nối máy chủ. Vui lòng kiểm tra lại.';

      if (dioErr.response?.data is Map) {
        final data = dioErr.response!.data as Map;
        final code = data['code']?.toString();
        final msg = data['message']?.toString();

        if (code == 'EMAIL_ALREADY_REGISTERED' ||
            (msg != null && msg.toLowerCase().contains('already registered'))) {
          errorMessage = 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.';
        } else if (msg != null && msg.isNotEmpty) {
          errorMessage = msg;
        }
      } else if (dioErr.type == DioExceptionType.connectionTimeout ||
          dioErr.type == DioExceptionType.receiveTimeout) {
        errorMessage = 'Hết thời gian chờ phản hồi từ máy chủ. Vui lòng thử lại.';
      } else if (dioErr.type == DioExceptionType.connectionError) {
        errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend (cổng 3001).';
      }

      emit(RegisterFailure(errorMessage));
    } catch (e) {
      emit(RegisterFailure('Đã xảy ra lỗi không xác định: $e'));
    }
  }
}
