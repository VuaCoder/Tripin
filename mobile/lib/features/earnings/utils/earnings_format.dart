import 'package:intl/intl.dart';

import '../models/earnings_models.dart';

export '../../guide/utils/guide_format.dart' show formatVnd;

const Duration _vnOffset = Duration(hours: 7);

/// Inclusive date range sent to both earnings endpoints.
class EarningsRange {
  const EarningsRange({this.from, this.to});

  final String? from;
  final String? to;
}

/// Vietnam calendar presets (UTC+7), returned as UTC ISO strings.
EarningsRange earningsRangeFor(EarningsFilter filter, {DateTime? now}) {
  final anchor = (now ?? DateTime.now()).toUtc();
  final vnNow = anchor.add(_vnOffset);
  String iso(DateTime vnWallTime) =>
      vnWallTime.subtract(_vnOffset).toIso8601String();

  switch (filter) {
    case EarningsFilter.thisMonth:
      final start = DateTime.utc(vnNow.year, vnNow.month, 1);
      final end = DateTime.utc(vnNow.year, vnNow.month + 1, 1)
          .subtract(const Duration(milliseconds: 1));
      return EarningsRange(from: iso(start), to: iso(end));
    case EarningsFilter.lastMonth:
      final start = DateTime.utc(vnNow.year, vnNow.month - 1, 1);
      final end = DateTime.utc(vnNow.year, vnNow.month, 1)
          .subtract(const Duration(milliseconds: 1));
      return EarningsRange(from: iso(start), to: iso(end));
    case EarningsFilter.all:
      return const EarningsRange();
  }
}

/// Recorded time in Vietnam time, regardless of the device timezone.
String formatEarnedAt(DateTime? value) {
  if (value == null) return '—';
  final vn = value.toUtc().add(_vnOffset);
  return DateFormat('dd/MM/yyyy HH:mm').format(vn);
}

/// One slice of the earnings chart.
class EarningsPeriod {
  const EarningsPeriod({required this.label, required this.totalAmount, required this.count});

  /// `10/26` for months, `Q4/26` for quarters.
  final String label;
  final int totalAmount;
  final int count;
}

/// Monthly (or quarterly) shares in ascending order of time.
List<EarningsPeriod> earningsPeriods(List<EarningsMonth> months, {bool quarterly = false}) {
  final totals = <int, EarningsPeriod>{};
  for (final month in months) {
    final parts = month.month.split('-');
    if (parts.length != 2) continue;
    final year = int.tryParse(parts[0]);
    final index = int.tryParse(parts[1]);
    if (year == null || index == null || index < 1 || index > 12) continue;
    final step = quarterly ? (index - 1) ~/ 3 + 1 : index;
    final yearShort = (year % 100).toString().padLeft(2, '0');
    final label = quarterly
        ? 'Q$step/$yearShort'
        : '${index.toString().padLeft(2, '0')}/$yearShort';
    final key = quarterly ? year * 4 + step : year * 12 + index;
    final previous = totals[key];
    totals[key] = EarningsPeriod(
      label: label,
      totalAmount: (previous?.totalAmount ?? 0) + month.totalAmount,
      count: (previous?.count ?? 0) + month.count,
    );
  }
  final keys = totals.keys.toList()..sort();
  return [for (final key in keys) totals[key]!];
}

String maskAccountNumber(String accountNumber) {
  if (accountNumber.length <= 4) return '••••';
  return '•••• ${accountNumber.substring(accountNumber.length - 4)}';
}
