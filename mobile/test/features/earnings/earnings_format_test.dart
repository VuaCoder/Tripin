import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/earnings/models/earnings_models.dart';
import 'package:mobile/features/earnings/utils/earnings_format.dart';

void main() {
  test('formats whole VND with Vietnamese grouping and the đ symbol', () {
    final formatted = formatVnd(1500000).replaceAll('\u00A0', ' ');
    expect(formatted, '1.500.000 đ');
    expect(formatVnd(0).replaceAll('\u00A0', ' '), '0 đ');
  });

  test('this month is the Vietnamese calendar month in UTC bounds', () {
    final range = earningsRangeFor(
      EarningsFilter.thisMonth,
      now: DateTime.utc(2026, 10, 31, 12),
    );
    expect(range.from, '2026-09-30T17:00:00.000Z');
    expect(range.to, '2026-10-31T16:59:59.999Z');
  });

  test('last month covers the previous Vietnamese calendar month', () {
    final range = earningsRangeFor(
      EarningsFilter.lastMonth,
      now: DateTime.utc(2026, 10, 31, 12),
    );
    expect(range.from, '2026-08-31T17:00:00.000Z');
    expect(range.to, '2026-09-30T16:59:59.999Z');
  });

  test('all sends no date range', () {
    final range = earningsRangeFor(EarningsFilter.all);
    expect(range.from, isNull);
    expect(range.to, isNull);
  });

  test('recorded time is shown in Vietnam time (UTC+7)', () {
    expect(formatEarnedAt(DateTime.utc(2026, 10, 31, 17, 30)), '01/11/2026 00:30');
    expect(formatEarnedAt(null), '—');
  });

  test('masked account numbers hide all but the last four digits', () {
    expect(maskAccountNumber('0123456789'), '•••• 6789');
    expect(maskAccountNumber('123'), '••••');
  });

  test('chart periods are monthly by default and merge into quarters on demand', () {
    const months = [
      EarningsMonth(month: '2026-10', totalAmount: 2000000, count: 2),
      EarningsMonth(month: '2026-09', totalAmount: 1000000, count: 1),
      EarningsMonth(month: '2025-12', totalAmount: 500000, count: 1),
    ];

    final monthly = earningsPeriods(months);
    expect(monthly.map((p) => p.label), ['12/25', '09/26', '10/26']);
    expect(monthly.last.totalAmount, 2000000);

    final quarterly = earningsPeriods(months, quarterly: true);
    expect(quarterly.map((p) => p.label), ['Q4/25', 'Q3/26', 'Q4/26']);
    expect(quarterly[1].count, 1);
    expect(quarterly.last.count, 2);

    expect(earningsPeriods(const [EarningsMonth(month: 'bad', totalAmount: 1, count: 1)]), isEmpty);
  });
}
