import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/guide/models/guide_models.dart';
import 'package:mobile/features/guide/widgets/check_in_result_dialog.dart';

void main() {
  testWidgets('success dialog shows the holder and ticket count', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: CheckInResultDialog(
            outcome: CheckInSuccess(
              CheckInResult(
                ticketId: 'e1',
                holderName: 'Nguyễn An',
                participants: 2,
                tourTitle: 'Hạ Long 3N2Đ',
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Điểm danh thành công'), findsOneWidget);
    expect(find.text('Nguyễn An - 2 vé'), findsOneWidget);
    expect(find.text('Tour: Hạ Long 3N2Đ'), findsOneWidget);
  });

  testWidgets('failure dialog shows the specific error', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: CheckInResultDialog(
            outcome: CheckInFailure(
              code: 'TICKET_ALREADY_USED',
              message: 'Vé này đã được điểm danh trước đó.',
            ),
          ),
        ),
      ),
    );

    expect(find.text('Điểm danh thất bại'), findsOneWidget);
    expect(find.text('Vé này đã được điểm danh trước đó.'), findsOneWidget);
  });
}
