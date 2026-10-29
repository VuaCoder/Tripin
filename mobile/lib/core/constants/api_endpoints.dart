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
  static const String me = '/users/me';
  static const String refresh = '/auth/refresh';

  // Tours endpoints (PRM393: Product List & Detail)
  static const String tours = '/tours';
  static String tourDetail(String id) => '/tours/$id';
  static String tourReviews(String id) => '/tours/$id/reviews';

  // Wishlist (Danh sách yêu thích)
  static const String wishlist = '/wishlist';
  static String wishlistTour(String tourId) => '/wishlist/$tourId';

  // Bookings / Checkout
  static const String bookings = '/bookings';
  static String bookingDetail(String id) => '/bookings/$id';
  static const String myBookings = '/bookings/me';
  static String cancelBooking(String id) => '/bookings/$id/cancel';

  // E-tickets (vé điện tử QR)
  static String eTicketByBooking(String bookingId) => '/e-tickets/booking/$bookingId';
  static String eTicketDetail(String id) => '/e-tickets/$id';

  // Policies (public)
  static const String cancellationPolicy = '/policies/cancellation';

  // Payments (PayOS)
  static String bookingCheckout(String bookingId) => '/payments/bookings/$bookingId/checkout';
  static String paymentDetail(String id) => '/payments/$id';

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
