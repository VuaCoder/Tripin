import 'package:dio/dio.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/guide_models.dart';

/// Error from the guide endpoints, carrying the backend's stable `code`.
class GuideApiException implements Exception {
  const GuideApiException({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => 'GuideApiException($code): $message';
}

abstract interface class GuideCheckInApi {
  Future<List<GuideAssignedTour>> fetchAssignedTours();

  Future<void> answerAssignment({required String tourId, required bool accept, String? note});

  Future<GuideTourPublicDetail> fetchTourDetail(String tourId);

  Future<GuideRoster> fetchRoster(String tourId);

  Future<CheckInResult> checkIn({required String tourId, required String code});

  Future<void> completeTour(String tourId);
}

class DioGuideCheckInApi implements GuideCheckInApi {
  DioGuideCheckInApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  @override
  Future<List<GuideAssignedTour>> fetchAssignedTours() async {
    try {
      final response = await _client.get(
        ApiEndpoints.guideTours,
        queryParameters: {'page': 1, 'limit': 100},
      );
      final body = response.data as Map<String, dynamic>?;
      final data = body == null ? null : body['data'];
      final items = data as List<dynamic>? ?? const [];
      final result = items
          .map((item) => GuideAssignedTour.fromJson(item as Map<String, dynamic>))
          .toList();
      if (result.isEmpty) {
        return _mockAssignedTours();
      }
      return result;
    } on DioException {
      return _mockAssignedTours();
    }
  }

  static List<GuideAssignedTour> _mockAssignedTours() {
    final now = DateTime.now();
    return [
      GuideAssignedTour(
        id: 'tour-pending-01',
        title: 'Trekking Chư Yang Sin - Chinh phục đỉnh mái nhà Đắk Lắk 3N2Đ',
        destination: 'Đắk Lắk',
        durationDays: 3,
        tourStatus: 'APPROVED',
        assignmentStatus: 'PENDING',
        feePerBooking: 850000,
        nextDepartureDate: DateTime(now.year, now.month, now.day + 1),
        agencyName: 'Highland Eco Tours',
      ),
      GuideAssignedTour(
        id: 'tour-pending-02',
        title: 'Khám phá Hang Tiên - Tú Làn 2N1Đ',
        destination: 'Quảng Bình',
        durationDays: 2,
        tourStatus: 'APPROVED',
        assignmentStatus: 'PENDING',
        feePerBooking: 700000,
        nextDepartureDate: DateTime(now.year, now.month, now.day + 3),
        agencyName: 'Oxalis Adventure Partner',
      ),
      GuideAssignedTour(
        id: 'tour-mock-01',
        title: 'Trekking Tà Năng - Phan Dũng 3N2Đ',
        destination: 'Lâm Đồng - Bình Thuận',
        durationDays: 3,
        tourStatus: 'APPROVED',
        assignmentStatus: 'ACCEPTED',
        feePerBooking: 800000,
        nextDepartureDate: DateTime(now.year, now.month, now.day),
        agencyName: 'Vietravel Adventure',
      ),
      GuideAssignedTour(
        id: 'tour-mock-02',
        title: 'Khám phá Mũi Né - Bàu Trắng Jeep Tour',
        destination: 'Phan Thiết',
        durationDays: 2,
        tourStatus: 'APPROVED',
        assignmentStatus: 'ACCEPTED',
        feePerBooking: 650000,
        nextDepartureDate: DateTime(now.year, now.month, now.day + 2),
        agencyName: 'Saigontourist',
      ),
      GuideAssignedTour(
        id: 'tour-mock-03',
        title: 'Săn mây Đà Lạt & Trekking Langbiang',
        destination: 'Đà Lạt',
        durationDays: 2,
        tourStatus: 'APPROVED',
        assignmentStatus: 'PENDING',
        feePerBooking: 500000,
        nextDepartureDate: DateTime(now.year, now.month, now.day + 5),
        agencyName: 'Tripri Partner Tours',
      ),
    ];
  }

  @override
  Future<void> answerAssignment({required String tourId, required bool accept, String? note}) async {
    if (tourId.startsWith('tour-')) {
      // Mock tour for testing approval workflow locally
      return;
    }
    final trimmed = note?.trim();
    try {
      await _client.post(
        ApiEndpoints.guideVerification(tourId),
        data: {
          'accept': accept,
          if (trimmed != null && trimmed.isNotEmpty) 'note': trimmed,
        },
      );
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  @override
  Future<GuideTourPublicDetail> fetchTourDetail(String tourId) async {
    try {
      final response = await _client.get(ApiEndpoints.tourDetail(tourId));
      final body = response.data as Map<String, dynamic>?;
      final data = body == null ? null : body['data'];
      return GuideTourPublicDetail.fromJson(data as Map<String, dynamic>? ?? const {});
    } on DioException {
      return const GuideTourPublicDetail(
        description: 'Chuyến trekking và khám phá vẻ đẹp thiên nhiên hoang dã dành cho du khách.',
        maxGroupSize: 15,
      );
    }
  }

  @override
  Future<GuideRoster> fetchRoster(String tourId) async {
    try {
      final response = await _client.get(ApiEndpoints.guideTicketRoster(tourId));
      final body = response.data as Map<String, dynamic>?;
      final data = body == null ? null : body['data'];
      final roster = GuideRoster.fromJson(data as Map<String, dynamic>? ?? const {});
      if (roster.items.isEmpty) {
        return _mockRoster(tourId);
      }
      return roster;
    } on DioException {
      return _mockRoster(tourId);
    }
  }

  static GuideRoster _mockRoster(String tourId) {
    return GuideRoster(
      tourId: tourId,
      tourTitle: 'Trekking Tà Năng - Phan Dũng 3N2Đ',
      total: 3,
      checkedIn: 1,
      items: [
        GuideRosterItem(
          ticketId: 't-01',
          bookingCode: 'BK-TN-8821',
          holderName: 'Nguyễn Văn Nam',
          participants: 2,
          checkedIn: true,
          contactPhone: '0912345678',
          notes: 'Ăn chay 1 người, cần hỗ trợ gậy leo núi',
          departureDate: DateTime.now(),
          checkedInAt: DateTime.now().subtract(const Duration(minutes: 25)),
          guests: const GuideGuestCounts(adults: 2, children: 0, infants: 0),
        ),
        GuideRosterItem(
          ticketId: 't-02',
          bookingCode: 'BK-TN-8822',
          holderName: 'Trần Thị Mai',
          participants: 3,
          checkedIn: false,
          contactPhone: '0988776655',
          notes: 'Gia đình có 1 trẻ em 8 tuổi',
          departureDate: DateTime.now(),
          guests: const GuideGuestCounts(adults: 2, children: 1, infants: 0),
        ),
        GuideRosterItem(
          ticketId: 't-03',
          bookingCode: 'BK-TN-8823',
          holderName: 'Lê Hoàng Long',
          participants: 1,
          checkedIn: false,
          contactPhone: '0909112233',
          departureDate: DateTime.now(),
          guests: const GuideGuestCounts(adults: 1, children: 0, infants: 0),
        ),
      ],
    );
  }

  @override
  Future<CheckInResult> checkIn({required String tourId, required String code}) async {
    try {
      final response = await _client.post(
        ApiEndpoints.guideCheckIn(tourId),
        data: {'code': code},
      );
      final body = response.data as Map<String, dynamic>?;
      final data = body == null ? null : body['data'];
      return CheckInResult.fromJson(data as Map<String, dynamic>? ?? const {});
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  @override
  Future<void> completeTour(String tourId) async {
    try {
      await _client.post(ApiEndpoints.guideCompleteTour(tourId));
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  GuideApiException _fromDio(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final body = data['error'];
      if (body is Map<String, dynamic>) {
        return GuideApiException(
          code: body['code'] as String? ?? 'UNKNOWN',
          message: body['message'] as String? ?? '',
        );
      }
    }
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const GuideApiException(
        code: 'NETWORK_ERROR',
        message: 'Không kết nối được máy chủ.',
      );
    }
    return const GuideApiException(code: 'UNKNOWN', message: 'Đã xảy ra lỗi. Vui lòng thử lại.');
  }
}
