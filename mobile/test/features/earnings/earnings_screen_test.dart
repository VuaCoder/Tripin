import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/earnings/api/earnings_api.dart';
import 'package:mobile/features/earnings/models/earnings_models.dart';
import 'package:mobile/features/earnings/screens/earnings_screen.dart';
import 'package:mobile/features/earnings/widgets/bank_account_sheet.dart';

const _earning = Earning(
  id: 'e1',
  bookingCode: 'BK-2026-001',
  tourId: 't1',
  tourTitle: 'Hạ Long 3N2Đ',
  amount: 750000,
  earnedAt: null,
);

const _summary = EarningsSummary(
  totalAmount: 1500000,
  count: 2,
  byMonth: [EarningsMonth(month: '2026-10', totalAmount: 1500000, count: 2)],
);

class _FakeApi implements EarningsApi {
  _FakeApi({this.items = const [], this.summary = _summary});

  final List<Earning> items;
  final EarningsSummary summary;
  BankAccount? saved;

  @override
  Future<EarningsPage> fetchEarnings({
    String? from,
    String? to,
    int page = 1,
    int limit = 10,
  }) async =>
      EarningsPage(
        items: items,
        page: page,
        limit: limit,
        total: items.length,
        totalPages: 1,
      );

  @override
  Future<EarningsSummary> fetchSummary({String? from, String? to}) async => summary;

  @override
  Future<BankAccount?> fetchBankAccount() async => null;

  @override
  Future<BankAccount?> saveBankAccount(BankAccount account) async {
    saved = account;
    return account;
  }
}

Future<void> _pump(WidgetTester tester, EarningsApi api) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  await tester.pumpWidget(MaterialApp(home: EarningsScreen(api: api)));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('renders summary, history and the empty bank state', (tester) async {
    await _pump(tester, _FakeApi(items: const [_earning]));

    expect(find.text('Thu nhập'), findsOneWidget);
    expect(find.textContaining('1.500.000'), findsWidgets);
    expect(find.text('Hạ Long 3N2Đ'), findsOneWidget);
    expect(find.text('Tháng này'), findsOneWidget);
    expect(find.text('Tháng trước'), findsOneWidget);
    expect(find.text('Toàn bộ'), findsOneWidget);
    expect(find.textContaining('Chưa cập nhật tài khoản'), findsOneWidget);
  });

  testWidgets('shows the empty state and switches to the all-time filter', (tester) async {
    await _pump(
      tester,
      _FakeApi(
        summary: const EarningsSummary(totalAmount: 0, count: 0, byMonth: []),
      ),
    );

    expect(find.text('Không có thu nhập trong kỳ này'), findsOneWidget);

    await tester.tap(find.text('Toàn bộ'));
    await tester.pumpAndSettle();

    expect(find.text('Chưa có thu nhập'), findsOneWidget);
  });

  testWidgets('draws the earnings pie and regroups it by quarter', (tester) async {
    await _pump(
      tester,
      _FakeApi(
        items: const [_earning],
        summary: const EarningsSummary(
          totalAmount: 3000000,
          count: 3,
          byMonth: [
            EarningsMonth(month: '2026-10', totalAmount: 2000000, count: 2),
            EarningsMonth(month: '2026-07', totalAmount: 1000000, count: 1),
          ],
        ),
      ),
    );

    expect(find.text('Thu nhập theo thời gian'), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);
    expect(find.text('07/26'), findsOneWidget);
    expect(find.text('10/26'), findsOneWidget);
    expect(find.text('67%'), findsOneWidget);
    expect(find.text('33%'), findsOneWidget);

    await tester.tap(find.text('Quý'));
    await tester.pumpAndSettle();

    expect(find.text('Q3/26'), findsOneWidget);
    expect(find.text('Q4/26'), findsOneWidget);
    expect(find.text('10/26'), findsNothing);
  });

  testWidgets('saves the payout account through the bank sheet', (tester) async {
    final api = _FakeApi(
      summary: const EarningsSummary(totalAmount: 0, count: 0, byMonth: []),
    );
    await _pump(tester, api);

    await tester.tap(find.text('Cập nhật'));
    await tester.pumpAndSettle();
    expect(find.byType(BankAccountSheet), findsOneWidget);

    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'Vietcombank');
    await tester.enterText(fields.at(1), '0123456789');
    await tester.enterText(fields.at(2), 'NGUYEN VAN A');
    await tester.tap(find.text('Lưu tài khoản'));
    await tester.pumpAndSettle();

    expect(api.saved?.accountNumber, '0123456789');
    expect(find.text('Đã cập nhật tài khoản nhận thù lao.'), findsOneWidget);
    expect(find.textContaining('•••• 6789'), findsOneWidget);
  });
}
