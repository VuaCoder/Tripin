import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../constants/api_endpoints.dart';

/// Dịch vụ quản lý xác thực tài khoản Google cho Tripri Mobile
class GoogleAuthService {
  final GoogleSignIn _googleSignIn;

  GoogleAuthService({GoogleSignIn? googleSignIn})
      : _googleSignIn = googleSignIn ??
            GoogleSignIn(
              serverClientId: ApiEndpoints.googleClientId,
              scopes: const ['email', 'profile'],
            );

  /// Đăng nhập bằng Google và trích xuất OpenID Connect ID Token.
  /// Trả về `String` chứa idToken nếu thành công.
  /// Trả về `null` nếu người dùng chủ động đóng hộp thoại chọn tài khoản.
  Future<String?> signIn() async {
    try {
      // Đảm bảo không dính phiên cũ
      if (await _googleSignIn.isSignedIn()) {
        await _googleSignIn.signOut();
      }

      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      if (account == null) {
        // Người dùng hủy hộp thoại đăng nhập
        return null;
      }

      final GoogleSignInAuthentication auth = await account.authentication;
      final idToken = auth.idToken;

      if (idToken == null || idToken.isEmpty) {
        throw Exception('Không tìm thấy Google ID Token từ tài khoản đã chọn.');
      }

      return idToken;
    } catch (e) {
      debugPrint('[GoogleAuthService] Lỗi đăng nhập Google: $e');
      rethrow;
    }
  }

  /// Đăng xuất tài khoản Google khỏi thiết bị
  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
    } catch (e) {
      debugPrint('[GoogleAuthService] Lỗi đăng xuất Google: $e');
    }
  }
}
