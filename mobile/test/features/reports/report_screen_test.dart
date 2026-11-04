import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/reports/bloc/reports_repository.dart';
import 'package:mobile/features/reports/models/report_models.dart';
import 'package:mobile/features/reports/screens/report_screen.dart';

// PNG 1x1 hợp lệ để Image.memory dựng được trong test.
const _png = <int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9C, 0x63, 0xF8, 0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xA7, 0x35, 0x81, 0x84, 0x00, 0x00, 0x00,
  0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
];

class _Repo extends ReportsRepository {
  Object? failWith;
  Map<String, Object?>? last;
  int photosSent = 0;

  @override
  Future<SubmittedReport> reportTourWithPhotos({
    required String tourId,
    String? bookingId,
    required ReportCategory category,
    required String description,
    required List<ReportPhoto> photos,
  }) async {
    photosSent = photos.length;
    final error = failWith;
    if (error != null) throw error;
    return const SubmittedReport(id: 't1', code: 'KN-20261029-0001', status: 'OPEN');
  }

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

Future<List<ReportPhoto>> _pick(int remaining) async =>
    [for (var i = 0; i < remaining.clamp(0, 2); i++) ReportPhoto(name: 'a$i.png', bytes: _png)];

Widget _app(_Repo repo) => MaterialApp(
      home: ReportScreen(tourId: 't1', tourTitle: 'Hạ Long 2N1Đ', bookingId: 'b1', repository: repo, pickPhotos: _pick),
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

  testWidgets('attached photos are shown, can be removed, and are capped at 5', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app(_Repo()));

    await tester.tap(find.textContaining('Đính kèm hình ảnh'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('photo-0')), findsOneWidget);
    expect(find.byKey(const Key('photo-1')), findsOneWidget);
    expect(find.text('Đính kèm hình ảnh (2/5)'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close).last);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('photo-1')), findsNothing);

    for (var i = 0; i < 3; i++) {
      await tester.tap(find.textContaining('Đính kèm hình ảnh'));
      await tester.pumpAndSettle();
    }
    expect(find.text('Đính kèm hình ảnh (5/5)'), findsOneWidget);
    final add = tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Đính kèm hình ảnh (5/5)'));
    expect(add.onPressed, isNull);
  });

  testWidgets('a report with photos is sent as a complaint and shows its ticket code', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final repo = _Repo();
    await tester.pumpWidget(_app(repo));
    await tester.enterText(find.byType(TextField), _text);
    await tester.tap(find.textContaining('Đính kèm hình ảnh'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gửi báo cáo'));
    await tester.pumpAndSettle();

    expect(repo.photosSent, 2);
    expect(repo.last, isNull); // không đi đường /reports
    expect(find.text('KN-20261029-0001'), findsOneWidget);
  });
}
