/// Time presets of the earnings history (AC3).
enum EarningsFilter {
  thisMonth('Tháng này'),
  lastMonth('Tháng trước'),
  all('Toàn bộ');

  const EarningsFilter(this.label);

  final String label;
}

/// One recorded earning (`GET /earnings/me`).
class Earning {  const Earning({
    required this.id,
    required this.bookingCode,
    required this.tourId,
    required this.tourTitle,
    required this.amount,
    this.earnedAt,
  });

  final String id;
  final String bookingCode;
  final String tourId;
  final String tourTitle;

  /// Whole VND, as stored by the backend.
  final int amount;
  final DateTime? earnedAt;

  factory Earning.fromJson(Map<String, dynamic> json) {
    final tour = json['tour'] as Map<String, dynamic>?;
    return Earning(
      id: json['id'] as String? ?? '',
      bookingCode: json['bookingCode'] as String? ?? '',
      tourId: tour?['id'] as String? ?? '',
      tourTitle: tour?['title'] as String? ?? '',
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      earnedAt: DateTime.tryParse(json['earnedAt'] as String? ?? ''),
    );
  }
}

/// Earnings for one calendar month, grouped in UTC by the backend.
class EarningsMonth {
  const EarningsMonth({
    required this.month,
    required this.totalAmount,
    required this.count,
  });

  /// `YYYY-MM`.
  final String month;
  final int totalAmount;
  final int count;

  factory EarningsMonth.fromJson(Map<String, dynamic> json) {
    return EarningsMonth(
      month: json['month'] as String? ?? '',
      totalAmount: (json['totalAmount'] as num?)?.toInt() ?? 0,
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

/// `GET /earnings/me/summary`.
class EarningsSummary {
  const EarningsSummary({
    required this.totalAmount,
    required this.count,
    required this.byMonth,
  });

  final int totalAmount;
  final int count;
  final List<EarningsMonth> byMonth;

  factory EarningsSummary.fromJson(Map<String, dynamic> json) {
    final months = json['byMonth'] as List<dynamic>? ?? const [];
    return EarningsSummary(
      totalAmount: (json['totalAmount'] as num?)?.toInt() ?? 0,
      count: (json['count'] as num?)?.toInt() ?? 0,
      byMonth: months
          .map((item) => EarningsMonth.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// One page of `GET /earnings/me` (items + pagination meta).
class EarningsPage {
  const EarningsPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<Earning> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory EarningsPage.fromResponse(Map<String, dynamic> body) {
    final items = body['data'] as List<dynamic>? ?? const [];
    final meta = body['meta'] as Map<String, dynamic>? ?? const {};
    return EarningsPage(
      items: items
          .map((item) => Earning.fromJson(item as Map<String, dynamic>))
          .toList(),
      page: (meta['page'] as num?)?.toInt() ?? 1,
      limit: (meta['limit'] as num?)?.toInt() ?? items.length,
      total: (meta['total'] as num?)?.toInt() ?? items.length,
      totalPages: (meta['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

/// Payout details of the logged-in guide, stored by `PATCH /users/me`.
class BankAccount {
  const BankAccount({
    required this.bankName,
    required this.accountNumber,
    required this.accountHolder,
  });

  final String bankName;
  final String accountNumber;
  final String accountHolder;

  factory BankAccount.fromJson(Map<String, dynamic> json) {
    return BankAccount(
      bankName: json['bankName'] as String? ?? '',
      accountNumber: json['accountNumber'] as String? ?? '',
      accountHolder: json['accountHolder'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'bankName': bankName,
        'accountNumber': accountNumber,
        'accountHolder': accountHolder,
      };
}
