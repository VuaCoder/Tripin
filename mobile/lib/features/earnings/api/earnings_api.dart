import 'package:dio/dio.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/api_client.dart';
import '../models/earnings_models.dart';

/// Error from the earnings / payout endpoints, carrying the backend's stable code.
class EarningsApiException implements Exception {
  const EarningsApiException({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => 'EarningsApiException($code): $message';
}

abstract interface class EarningsApi {
  Future<EarningsPage> fetchEarnings({
    String? from,
    String? to,
    int page = 1,
    int limit = 10,
  });

  Future<EarningsSummary> fetchSummary({String? from, String? to});

  Future<BankAccount?> fetchBankAccount();

  Future<BankAccount?> saveBankAccount(BankAccount account);
}

class DioEarningsApi implements EarningsApi {
  DioEarningsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  @override
  Future<EarningsPage> fetchEarnings({
    String? from,
    String? to,
    int page = 1,
    int limit = 10,
  }) async {
    try {
      final response = await _client.get(
        ApiEndpoints.myEarnings,
        queryParameters: {
          'page': page,
          'limit': limit,
          'from': ?from,
          'to': ?to,
        },
      );
      final body = response.data as Map<String, dynamic>? ?? const {};
      return EarningsPage.fromResponse(body);
    } on DioException catch (error) {
      throw _fromDio(error, 'Không tải được lịch sử thu nhập.');
    }
  }

  @override
  Future<EarningsSummary> fetchSummary({String? from, String? to}) async {
    try {
      final response = await _client.get(
        ApiEndpoints.myEarningsSummary,
        queryParameters: {'from': ?from, 'to': ?to},
      );
      final body = response.data as Map<String, dynamic>? ?? const {};
      final data = body['data'] as Map<String, dynamic>? ?? const {};
      return EarningsSummary.fromJson(data);
    } on DioException catch (error) {
      throw _fromDio(error, 'Không tải được tổng hợp thu nhập.');
    }
  }

  @override
  Future<BankAccount?> fetchBankAccount() async {
    try {
      final response = await _client.get(ApiEndpoints.me);
      return _bankAccountOf(response.data);
    } on DioException catch (error) {
      throw _fromDio(error, 'Không tải được tài khoản nhận thù lao.');
    }
  }

  @override
  Future<BankAccount?> saveBankAccount(BankAccount account) async {
    try {
      final response = await _client.patch(
        ApiEndpoints.me,
        data: {'bankAccount': account.toJson()},
      );
      return _bankAccountOf(response.data) ?? account;
    } on DioException catch (error) {
      throw _fromDio(error, 'Không lưu được tài khoản nhận thù lao.');
    }
  }

  BankAccount? _bankAccountOf(dynamic responseData) {
    final body = responseData as Map<String, dynamic>? ?? const {};
    final data = body['data'] as Map<String, dynamic>? ?? body;
    final bank = data['bankAccount'];
    return bank is Map<String, dynamic> ? BankAccount.fromJson(bank) : null;
  }

  EarningsApiException _fromDio(DioException error, String fallback) {
    final data = error.response?.data;
    if (data is Map) {
      final body = data['error'];
      if (body is Map) {
        return EarningsApiException(
          code: body['code'] as String? ?? 'UNKNOWN',
          message: body['message'] as String? ?? fallback,
        );
      }
    }
    if (error.response?.statusCode == 401) {
      return const EarningsApiException(
        code: 'UNAUTHENTICATED',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }
    if (error.response?.statusCode == 403) {
      return const EarningsApiException(
        code: 'FORBIDDEN',
        message: 'Tài khoản không có quyền xem thu nhập.',
      );
    }
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return EarningsApiException(
        code: 'NETWORK',
        message: '$fallback Kiểm tra kết nối và thử lại.',
      );
    }
    return EarningsApiException(code: 'UNKNOWN', message: fallback);
  }
}
