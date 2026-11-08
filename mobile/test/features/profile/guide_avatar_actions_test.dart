import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/widgets/guide_avatar_actions.dart';

void main() {
  testWidgets('offers upload and hides removal when no avatar exists', (
    tester,
  ) async {
    var picked = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: GuideAvatarActions(onUpload: () => picked = true)),
      ),
    );
    expect(find.text('Xóa ảnh'), findsNothing);
    await tester.tap(find.text('Chọn ảnh đại diện'));
    expect(picked, isTrue);
  });
  testWidgets('disables actions while a request is in flight', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: GuideAvatarActions())),
    );
    expect(
      tester.widget<TextButton>(find.byType(TextButton).first).onPressed,
      isNull,
    );
  });
}
