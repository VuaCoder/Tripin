import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/guide/api/guide_check_in_api.dart';
import 'package:mobile/features/guide/models/guide_models.dart';
import 'package:mobile/features/guide/screens/guide_tours_screen.dart';

class FakeGuideApi implements GuideCheckInApi {
  FakeGuideApi(this.tours);

  final List<GuideAssignedTour> tours;
  int answerCalls = 0;

  @override
  Future<List<GuideAssignedTour>> fetchAssignedTours() async => tours;

  @override
  Future<void> answerAssignment({
    required String tourId,
    required bool accept,
    String? note,
  }) async {
    answerCalls++;
  }

  @override
  Future<GuideTourPublicDetail> fetchTourDetail(String tourId) async =>
      const GuideTourPublicDetail();

  @override
  Future<GuideRoster> fetchRoster(String tourId) async =>
      throw UnimplementedError();

  @override
  Future<CheckInResult> checkIn({
    required String tourId,
    required String code,
  }) async => throw UnimplementedError();
}

const pending = GuideAssignedTour(
  id: 'p1',
  title: 'Hạ Long 3N2Đ',
  destination: 'Hạ Long',
  durationDays: 3,
  tourStatus: 'APPROVED',
  assignmentStatus: 'PENDING',
  feePerBooking: 500000,
);

void main() {
  testWidgets('accepting moves the tour to the upcoming tab', (tester) async {
    final api = FakeGuideApi([pending]);
    await tester.pumpWidget(MaterialApp(home: GuideToursScreen(api: api)));
    await tester.pumpAndSettle();

    expect(find.text('Chờ xác nhận (1)'), findsOneWidget);
    expect(find.text('Lịch sắp tới (0)'), findsOneWidget);

    await tester.tap(find.text('Hạ Long 3N2Đ'));
    await tester.pumpAndSettle();
    expect(find.text('Chi tiết phân công'), findsOneWidget);

    await tester.tap(find.text('Chấp nhận'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận nhận tour'));
    await tester.pumpAndSettle();

    expect(api.answerCalls, 1);
    expect(find.text('Chờ xác nhận (0)'), findsOneWidget);
    expect(find.text('Lịch sắp tới (1)'), findsOneWidget);
    expect(find.text('Hạ Long 3N2Đ'), findsOneWidget);
    expect(
      find.text('Đã nhận tour. Tour đã chuyển sang Lịch sắp tới.'),
      findsOneWidget,
    );
  });
}
