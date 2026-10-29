import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/guide/models/guide_models.dart';
import 'package:mobile/features/guide/widgets/answer_assignment_dialog.dart';

const _tour = GuideAssignedTour(
  id: 't1',
  title: 'Hạ Long 3N2Đ',
  destination: 'Hạ Long',
  durationDays: 3,
  tourStatus: 'APPROVED',
  assignmentStatus: 'PENDING',
  feePerBooking: 500000,
);

void main() {
  testWidgets('a decline requires a reason and returns it', (tester) async {
    String? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await showAnswerAssignmentDialog(
                  context,
                  tour: _tour,
                  accept: false,
                );
              },
              child: const Text('Mở'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Mở'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Xác nhận từ chối'));
    await tester.pumpAndSettle();

    expect(find.text('Vui lòng nhập lý do từ chối.'), findsOneWidget);
    expect(result, isNull);

    await tester.enterText(find.byType(TextFormField), 'Trùng lịch dẫn tour');
    await tester.tap(find.text('Xác nhận từ chối'));
    await tester.pumpAndSettle();

    expect(result, 'Trùng lịch dẫn tour');
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('an acceptance allows an empty note', (tester) async {
    String? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await showAnswerAssignmentDialog(
                  context,
                  tour: _tour,
                  accept: true,
                );
              },
              child: const Text('Mở'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Mở'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Xác nhận nhận tour'));
    await tester.pumpAndSettle();

    expect(result, '');
    expect(find.byType(AlertDialog), findsNothing);
  });
}
