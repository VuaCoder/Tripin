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

  Future<GuideRoster> fetchRoster(String tourId);

  Future<CheckInResult> checkIn({required String tourId, required String code});
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
      return items
          .map((item) => GuideAssignedTour.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  @override
  Future<GuideRoster> fetchRoster(String tourId) async {
    try {
      final response = await _client.get(ApiEndpoints.guideTicketRoster(tourId));
      final body = response.data as Map<String, dynamic>?;
      final data = body == null ? null : body['data'];
      return GuideRoster.fromJson(data as Map<String, dynamic>? ?? const {});
    } on DioException catch (error) {
      throw _fromDio(error);
    }
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
