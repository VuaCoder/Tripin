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

  Future<void> answerAssignment({
    required String tourId,
    required bool accept,
    String? note,
  });

  Future<GuideTourPublicDetail> fetchTourDetail(String tourId);

  Future<GuideRoster> fetchRoster(String tourId);

  Future<CheckInResult> checkIn({required String tourId, required String code});

  Future<void> completeTour(String tourId);
}

class DioGuideCheckInApi implements GuideCheckInApi {
  DioGuideCheckInApi({ApiClient? client, this.departureId})
    : _client = client ?? ApiClient();
  final String? departureId;
  DioGuideCheckInApi forDeparture(String? id) =>
      DioGuideCheckInApi(client: _client, departureId: id);

  final ApiClient _client;

  @override
  Future<List<GuideAssignedTour>> fetchAssignedTours() async {
    try {
      final result = <GuideAssignedTour>[];
      var page = 1;
      var totalPages = 1;
      do {
        final response = await _client.get(
          ApiEndpoints.guideTours,
          queryParameters: {'page': page, 'limit': 100},
        );
        final body = response.data as Map<String, dynamic>;
        totalPages =
            ((body['meta'] as Map<String, dynamic>?)?['totalPages'] as num?)
                ?.toInt() ??
            1;
        for (final item in body['data'] as List) {
          final row = item as Map<String, dynamic>;
          final departures = row['departures'] as List? ?? const [];
          if ((row['assignment'] as Map?)?['status'] == 'ACCEPTED' &&
              departures.isNotEmpty) {
            for (final value in departures) {
              final departure = value as Map<String, dynamic>;
              result.add(
                GuideAssignedTour.fromJson({
                  ...row,
                  'departureId': departure['id'],
                  'nextDepartureDate': departure['date'],
                  'endDate': departure['endDate'],
                }),
              );
            }
          } else {
            result.add(GuideAssignedTour.fromJson(row));
          }
        }
        page++;
      } while (page <= totalPages);
      return result;
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  @override
  Future<void> answerAssignment({
    required String tourId,
    required bool accept,
    String? note,
  }) async {
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
      return GuideTourPublicDetail.fromJson(
        data as Map<String, dynamic>? ?? const {},
      );
    } on DioException {
      return const GuideTourPublicDetail(
        description:
            'Chuyến trekking và khám phá vẻ đẹp thiên nhiên hoang dã dành cho du khách.',
        maxGroupSize: 15,
      );
    }
  }

  @override
  Future<GuideRoster> fetchRoster(String tourId) async {
    try {
      final response = await _client.get(
        ApiEndpoints.guideTicketRoster(tourId),
        queryParameters: {if (departureId != null) 'departureId': departureId},
      );
      final body = response.data as Map<String, dynamic>?;
      final data = body == null ? null : body['data'];
      final roster = GuideRoster.fromJson(
        data as Map<String, dynamic>? ?? const {},
      );
      return roster;
    } on DioException catch (error) {
      throw _fromDio(error);
    }
  }

  @override
  Future<CheckInResult> checkIn({
    required String tourId,
    required String code,
  }) async {
    try {
      final response = await _client.post(
        '/e-tickets/scan',
        data: {
          'code': code,
          'tourId': tourId,
          if (departureId != null) 'departureId': departureId,
        },
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
      await _client.post(
        ApiEndpoints.guideCompleteTour(tourId),
        data: {if (departureId != null) 'departureId': departureId},
      );
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
    return const GuideApiException(
      code: 'UNKNOWN',
      message: 'Đã xảy ra lỗi. Vui lòng thử lại.',
    );
  }
}
