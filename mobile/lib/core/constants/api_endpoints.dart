import 'package:flutter/foundation.dart';

class ApiEndpoints {
  ApiEndpoints._();

  /// Tự động nhận diện host phù hợp:
  /// - Android Emulator dùng 10.0.2.2
  /// - Web hoặc Windows desktop dùng localhost
  static String get baseUrl {
    if (kIsWeb) {
      return 'http://localhost:3001/api/v1';
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'http://10.0.2.2:3001/api/v1';
      case TargetPlatform.windows:
      default:
        return 'http://localhost:3001/api/v1';
    }
  }

  // Auth endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String verifyOtp = '/auth/verify-otp';
  static const String resendOtp = '/auth/resend-otp';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String changePassword = '/auth/change-password';
  static const String me = '/users/me';
  static const String refresh = '/auth/refresh';

  // Users & Profile Uploads (Cloudinary Contract)
  static const String avatarUploadSignature = '/users/me/avatar/upload-signature';
  static const String avatarComplete = '/users/me/avatar/complete';
  static const String licenseImageUploadSignature = '/users/me/license-image/upload-signature';
  static const String licenseImageComplete = '/users/me/license-image/complete';

  // Tours endpoints (PRM393: Product List & Detail)
  static const String tours = '/tours';
  static String tourDetail(String id) => '/tours/$id';
  // Reviews endpoints (FLOW-08)
  static const String reviews = '/reviews';
  static String tourReviews(String tourId) => '/reviews?tourId=$tourId';
  static const String myReviews = '/reviews/me';

  // Wishlist (Danh sách yêu thích)
  static const String wishlist = '/wishlist';
  static String wishlistTour(String tourId) => '/wishlist/$tourId';

  // Bookings / Checkout
  static const String bookings = '/bookings';
  static String bookingDetail(String id) => '/bookings/$id';
  static const String myBookings = '/bookings/my';

  // Vouchers
  static const String myVouchers = '/users/me/vouchers';
  static const String collectVoucher = '/users/me/vouchers/collect';

  // Notifications (PRM393: Notifications)
  static const String notifications = '/notifications';
  static const String unreadNotificationsCount = '/notifications/unread-count';
  static String readNotification(String id) => '/notifications/$id/read';
  static const String readAllNotifications = '/notifications/read-all';

  // Chat / Messages (PRM393: Messaging)
  static const String conversations = '/chat/conversations';
  static String conversationMessages(String id) => '/chat/conversations/$id/messages';
}