import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/reports/bloc/reports_repository.dart';
import 'package:mobile/features/reports/models/report_models.dart';
import 'package:mobile/features/reports/screens/report_screen.dart';

class _Repo extends ReportsRepository {
  Object? failWith;
  Map<String, Object?>? last;

  @override
  Future<SubmittedReport> reportTour({
    required String tourId,
    String? bookingId,
    required ReportCategory category,
    required String description,
  }) async {
    last = {'tourId': tourId, 'bookingId': bookingId, 'category': category.apiValue, 'description': description};
    final error = failWith;
    if (error != null) throw error;
    return const SubmittedReport(id: 'r1', code: 'RP-1A2B3C4D', status: 'OPEN');
  }
}

Widget _app(_Repo repo) => MaterialApp(
      home: ReportScreen(tourId: 't1', tourTitle: 'Hạ Long 2N1Đ', bookingId: 'b1', repository: repo),
    );

const _text = 'Xe đón trễ hơn một tiếng so với lịch';

void main() {
  testWidgets('submit stays disabled until the description is long enough', (tester) async {
    await tester.pumpWidget(_app(_Repo()));
    FilledButton button() => tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button().onPressed, isNull);

    await tester.enterText(find.byType(TextField), 'ngắn');
    await tester.pump();
    expect(button().onPressed, isNull);

    await tester.enterText(find.byType(TextField), _text);
    await tester.pump();
    expect(button().onPressed, isNotNull);
  });

  testWidgets('a successful report shows the lookup code (AC4)', (tester) async {
    final repo = _Repo();
    await tester.pumpWidget(_app(repo));
    await tester.enterText(find.byType(TextField), _text);
    await tester.pump();
    await tester.tap(find.text('Gửi báo cáo'));
    await tester.pumpAndSettle();

    expect(find.text('Đã gửi báo cáo'), findsOneWidget);
    expect(find.byKey(const Key('report-code')), findsOneWidget);
    expect(find.text('RP-1A2B3C4D'), findsOneWidget);
    expect(repo.last?['tourId'], 't1');
    expect(repo.last?['bookingId'], 'b1');
    expect(repo.last?['category'], 'SAFETY');
  });

  testWidgets('a failed send keeps what the user typed and shows the error', (tester) async {
    final repo = _Repo()..failWith = const ReportException('Không kết nối được máy chủ.');
    await tester.pumpWidget(_app(repo));
    await tester.enterText(find.byType(TextField), _text);
    await tester.pump();
    await tester.tap(find.text('Gửi báo cáo'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('report-error')), findsOneWidget);
    expect(find.text(_text), findsOneWidget);
    expect(find.byKey(const Key('report-code')), findsNothing);
  });
}
