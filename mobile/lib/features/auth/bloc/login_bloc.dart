import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/google_auth_service.dart';
import '../../../core/storage/token_storage.dart';
import '../models/login_request.dart';
import 'login_event.dart';
import 'login_state.dart';

class LoginBloc extends Bloc<LoginEvent, LoginState> {
  final ApiClient apiClient;
  final TokenStorage tokenStorage;
  final GoogleAuthService googleAuthService;

  LoginBloc({
    ApiClient? client,
    TokenStorage? storage,
    GoogleAuthService? googleAuth,
  })  : apiClient = client ?? ApiClient(),
        tokenStorage = storage ?? TokenStorage(),
        googleAuthService = googleAuth ?? GoogleAuthService(),
        super(const LoginInitial()) {
    on<LoginSubmitted>(_onLoginSubmitted);
    on<LoginWithGoogleSubmitted>(_onLoginWithGoogleSubmitted);
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

        if (data['twoFactorRequired'] == true) {
          emit(LoginRequiresOtp(
            email: event.email,
            message: 'Tài khoản yêu cầu xác thực 2 bước. Mã OTP đã được gửi về email.',
          ));
          return;
        }

        emit(LoginSuccess(role: userRole, fullName: userName));
      } else {
        emit(const LoginFailure('Đăng nhập không thành công, vui lòng thử lại'));
      }
    } on DioException catch (e) {
      final resData = e.response?.data;
      String message = 'Đăng nhập thất bại';

      if (resData is Map) {
        final errorObj = resData['error'] is Map ? resData['error'] as Map : null;
        final code = errorObj?['code']?.toString() ?? resData['code']?.toString();
        final rawMsg = errorObj?['message']?.toString() ?? resData['message']?.toString();

        if (code == 'ACCOUNT_NOT_VERIFIED' || code == 'ACCOUNT_UNVERIFIED') {
          emit(LoginRequiresOtp(
            email: event.email,
            message: rawMsg ?? 'Tài khoản chưa kích hoạt. Mã OTP đã được gửi về email của bạn.',
          ));
          return;
        } else if (code == 'INVALID_CREDENTIALS' || e.response?.statusCode == 401) {
          message = 'Email hoặc mật khẩu không chính xác';
        } else if (code == 'ACCOUNT_LOCKED' || code == 'ACCOUNT_BANNED') {
          message = 'Tài khoản đã bị tạm khóa, vui lòng liên hệ hỗ trợ';
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

  Future<void> _onLoginWithGoogleSubmitted(
    LoginWithGoogleSubmitted event,
    Emitter<LoginState> emit,
  ) async {
    emit(const LoginLoading());
    try {
      final idToken = event.mockIdToken ?? await googleAuthService.signIn();
      if (idToken == null) {
        // Người dùng đã hủy hộp thoại Google Sign-in
        emit(const LoginInitial());
        return;
      }

      final payload = <String, dynamic>{
        'idToken': idToken,
        if (event.role != null && event.role!.isNotEmpty) 'role': event.role,
      };

      final response = await apiClient.post(
        ApiEndpoints.googleLogin,
        data: payload,
      );

      if (response.statusCode != null && response.statusCode! < 400 && response.data != null) {
        final data = response.data['data'] as Map<String, dynamic>? ?? response.data as Map<String, dynamic>;

        final accessToken = data['accessToken'] as String? ?? '';
        final user = data['user'] as Map<String, dynamic>? ?? {};

        final userId = user['id'] as String? ?? '';
        final userEmail = user['email'] as String? ?? '';
        final userName = user['fullName'] as String? ?? 'Người dùng Tripri';
        final userRole = user['role'] as String? ?? (event.role ?? 'TRAVELER');

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
        emit(const LoginFailure('Đăng nhập Google không thành công, vui lòng thử lại'));
      }
    } on DioException catch (e) {
      final resData = e.response?.data;
      String message = 'Đăng nhập Google thất bại';

      if (resData is Map) {
        final errorObj = resData['error'] is Map ? resData['error'] as Map : null;
        final code = errorObj?['code']?.toString() ?? resData['code']?.toString();
        final rawMsg = errorObj?['message']?.toString() ?? resData['message']?.toString();

        if (code == 'SERVICE_UNAVAILABLE') {
          message = 'Dịch vụ Google Sign-In trên hệ thống chưa sẵn sàng.';
        } else if (code == 'ACCOUNT_LOCKED' || code == 'ACCOUNT_BANNED') {
          message = 'Tài khoản Google này đã bị khóa trên hệ thống.';
        } else if (rawMsg != null && rawMsg.isNotEmpty) {
          message = rawMsg;
        }
      }
      emit(LoginFailure(message));
    } catch (e) {
      emit(LoginFailure('Lỗi đăng nhập Google: ${e.toString().replaceAll('Exception: ', '')}'));
    }
  }
}