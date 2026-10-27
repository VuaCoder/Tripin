import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../models/login_request.dart';
import 'login_event.dart';
import 'login_state.dart';

class LoginBloc extends Bloc<LoginEvent, LoginState> {
  final ApiClient apiClient;
  final TokenStorage tokenStorage;

  LoginBloc({
    ApiClient? client,
    TokenStorage? storage,
  })  : apiClient = client ?? ApiClient(),
        tokenStorage = storage ?? TokenStorage(),
        super(const LoginInitial()) {
    on<LoginSubmitted>(_onLoginSubmitted);
  }

  Future<void> _onLoginSubmitted(LoginSubmitted event, Emitter<LoginState> emit) async {
    emit(const LoginLoading());
    try {
      final request = LoginRequest(email: event.email, password: event.password);
      final response = await apiClient.post(
        ApiEndpoints.login,
        data: request.toJson(),
      );

      if (response.statusCode != null && response.statusCode! < 400 && response.data != null) {
        final data = response.data['data'] as Map<String, dynamic>? ?? response.data as Map<String, dynamic>;

        final accessToken = data['accessToken'] as String? ?? '';
        final user = data['user'] as Map<String, dynamic>? ?? {};

        final userId = user['id'] as String? ?? '';
        final userEmail = user['email'] as String? ?? event.email;
        final userName = user['fullName'] as String? ?? 'Người dùng Tripri';
        final userRole = user['role'] as String? ?? 'TRAVELER';

        // Lưu vào Secure Storage & SharedPreferences
        await tokenStorage.saveTokens(accessToken: accessToken);
        await tokenStorage.saveUserInfo(
          id: userId,
          email: userEmail,
          name: userName,
          role: userRole,
        );

        emit(LoginSuccess(role: userRole, fullName: userName));
      } else {
        emit(const LoginFailure('Đăng nhập không thành công, vui lòng thử lại'));
      }
    } on DioException catch (e) {
      final resData = e.response?.data;
      String message = 'Đăng nhập thất bại';

      if (resData is Map<String, dynamic>) {
        final code = resData['code'] as String?;
        final rawMsg = resData['message'] as String?;

        if (code == 'INVALID_CREDENTIALS' || e.response?.statusCode == 401) {
          message = 'Email hoặc mật khẩu không chính xác';
        } else if (code == 'ACCOUNT_LOCKED') {
          message = 'Tài khoản đã bị tạm khóa, vui lòng liên hệ hỗ trợ';
        } else if (code == 'ACCOUNT_UNVERIFIED') {
          message = 'Tài khoản chưa kích hoạt OTP, vui lòng kiểm tra email';
        } else if (rawMsg != null && rawMsg.isNotEmpty) {
          message = rawMsg;
        }
      } else if (e.response?.statusCode == 401) {
        message = 'Email hoặc mật khẩu không chính xác';
      }

      emit(LoginFailure(message));
    } catch (e) {
      emit(LoginFailure(e.toString()));
    }
  }
}