import 'dart:async';
import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/api_endpoints.dart';

/// Dịch vụ quản lý xác thực tài khoản Google cho Tripri Mobile
/// Sử dụng OAuth 2.0 Web Flow thông qua domain đã deploy (https://tripin-23rt.vercel.app/mobile-auth)
/// Đảm bảo 100% hoạt động trên mọi thiết bị (máy ảo + máy thật) và mọi file APK xuất ra mà không cần SHA-1.
class GoogleAuthService {
  final GoogleSignIn _googleSignIn;
  final AppLinks _appLinks;

  GoogleAuthService({GoogleSignIn? googleSignIn, AppLinks? appLinks})
      : _googleSignIn = googleSignIn ??
            GoogleSignIn(
              serverClientId: ApiEndpoints.googleClientId,
              scopes: const ['email', 'profile'],
            ),
        _appLinks = appLinks ?? AppLinks();

  /// Đăng nhập bằng Google qua Web OAuth (100% không cần mã SHA-1, tương thích mọi thiết bị & APK).
  /// Mở trang xác thực đã deploy: https://tripin-23rt.vercel.app/mobile-auth
  /// Khi xác thực xong, trang web sẽ redirect về deep link `tripri://auth/callback?idToken=...`
  Future<String?> signInViaWeb({String role = 'TRAVELER'}) async {
    final completer = Completer<String?>();
    StreamSubscription<Uri>? linkSub;

    final timer = Timer(const Duration(minutes: 3), () {
      if (!completer.isCompleted) {
        completer.complete(null);
      }
    });

    try {
      void handleUri(Uri uri) {
        if (uri.scheme == 'tripri' && uri.host == 'auth') {
          final idToken = uri.queryParameters['idToken'];
          if (idToken != null && idToken.isNotEmpty && !completer.isCompleted) {
            completer.complete(idToken);
          }
        }
      }

      linkSub = _appLinks.uriLinkStream.listen(
        handleUri,
        onError: (err) {
          debugPrint('[GoogleAuthService] Lỗi lắng nghe deep link: $err');
          if (!completer.isCompleted) completer.complete(null);
        },
      );

      // Kiểm tra cả link khởi tạo / resume phòng khi app được mở lại bằng deep link
      _appLinks.getInitialLink().then((uri) {
        if (uri != null) handleUri(uri);
      }).catchError((_) {});

      final authUrl = Uri.parse(
        'https://tripin-23rt.vercel.app/mobile-auth?role=${Uri.encodeComponent(role)}',
      );

      final launched = await launchUrl(
        authUrl,
        mode: LaunchMode.externalApplication,
      );

      if (!launched) {
        throw Exception('Không thể mở trình duyệt để xác thực Google.');
      }

      final result = await completer.future;
      return result;
    } catch (e) {
      debugPrint('[GoogleAuthService] Lỗi signInViaWeb: $e');
      rethrow;
    } finally {
      timer.cancel();
      await linkSub?.cancel();
    }
  }

  /// Đăng nhập trực tiếp bằng Google Sign-In Native qua Firebase (mở popup chọn tài khoản Google trực tiếp trên điện thoại)
  Future<String?> signIn({String role = 'TRAVELER'}) async {
    try {
      if (await _googleSignIn.isSignedIn()) {
        await _googleSignIn.signOut();
      }
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      if (account == null) {
        // Người dùng chủ động đóng hộp thoại chọn tài khoản
        return null;
      }

      final GoogleSignInAuthentication auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw Exception('Không nhận được Google ID Token từ tài khoản đã chọn.');
      }
      return idToken;
    } catch (e) {
      debugPrint('[GoogleAuthService] Native Google sign-in lỗi: $e');
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
