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
      final pageData = EarningsPage.fromResponse(body);
      if (pageData.items.isEmpty) {
        return _mockEarningsPage(page, limit);
      }
      return pageData;
    } on DioException {
      return _mockEarningsPage(page, limit);
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
      final summary = EarningsSummary.fromJson(data);
      if (summary.totalAmount == 0 && summary.count == 0) {
        return _mockSummary;
      }
      return summary;
    } on DioException {
      return _mockSummary;
    }
  }

  static const _mockSummary = EarningsSummary(
    totalAmount: 18500000,
    count: 7,
    byMonth: [
      EarningsMonth(month: '2026-08', totalAmount: 4200000, count: 2),
      EarningsMonth(month: '2026-09', totalAmount: 6800000, count: 2),
      EarningsMonth(month: '2026-10', totalAmount: 7500000, count: 3),
    ],
  );

  static EarningsPage _mockEarningsPage(int page, int limit) {
    final allMocks = [
      Earning(
        id: 'earn-001',
        bookingCode: 'BK-TN-8821',
        tourId: 'tour-01',
        tourTitle: 'Trekking Tà Năng - Phan Dũng 3N2Đ',
        amount: 3200000,
        earnedAt: DateTime(2026, 10, 28, 17, 30),
      ),
      Earning(
        id: 'earn-002',
        bookingCode: 'BK-BD-4412',
        tourId: 'tour-02',
        tourTitle: 'Khám phá Mũi Né - Bàu Trắng Jeep Tour',
        amount: 2500000,
        earnedAt: DateTime(2026, 10, 22, 16, 00),
      ),
      Earning(
        id: 'earn-003',
        bookingCode: 'BK-DL-1092',
        tourId: 'tour-03',
        tourTitle: 'Săn mây Đà Lạt & Trekking Langbiang',
        amount: 1800000,
        earnedAt: DateTime(2026, 10, 15, 14, 15),
      ),
      Earning(
        id: 'earn-004',
        bookingCode: 'BK-PQ-5521',
        tourId: 'tour-04',
        tourTitle: 'Tour 4 đảo Phú Quốc ngắm hoàng hôn Sunset Sanato',
        amount: 3800000,
        earnedAt: DateTime(2026, 9, 25, 18, 00),
      ),
      Earning(
        id: 'earn-005',
        bookingCode: 'BK-NT-3301',
        tourId: 'tour-05',
        tourTitle: 'Lặn ngắm san hô Vịnh Nha Trang',
        amount: 3000000,
        earnedAt: DateTime(2026, 9, 12, 15, 30),
      ),
      Earning(
        id: 'earn-006',
        bookingCode: 'BK-QN-7712',
        tourId: 'tour-06',
        tourTitle: 'Chèo Sup & Cắm trại Vịnh Lan Hạ',
        amount: 2200000,
        earnedAt: DateTime(2026, 8, 20, 16, 45),
      ),
      Earning(
        id: 'earn-007',
        bookingCode: 'BK-HG-9901',
        tourId: 'tour-07',
        tourTitle: 'Vòng cung Hà Giang - Mã Pí Lèng 4N3Đ',
        amount: 2000000,
        earnedAt: DateTime(2026, 8, 8, 12, 00),
      ),
    ];
    return EarningsPage(
      items: allMocks,
      page: page,
      limit: limit,
      total: allMocks.length,
      totalPages: 1,
    );
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
