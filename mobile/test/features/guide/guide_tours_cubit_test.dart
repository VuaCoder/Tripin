import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/guide/api/guide_check_in_api.dart';
import 'package:mobile/features/guide/cubit/guide_tours_cubit.dart';
import 'package:mobile/features/guide/models/guide_models.dart';

class FakeToursApi implements GuideCheckInApi {
  FakeToursApi({this.tours = const [], this.error, this.answerError});

  final List<GuideAssignedTour> tours;
  final GuideApiException? error;
  final GuideApiException? answerError;
  int answerCalls = 0;
  bool? lastAccept;
  String? lastNote;

  @override
  Future<List<GuideAssignedTour>> fetchAssignedTours() async {
    if (error != null) throw error!;
    return tours;
  }

  @override
  Future<void> answerAssignment({
    required String tourId,
    required bool accept,
    String? note,
  }) async {
    answerCalls++;
    lastAccept = accept;
    lastNote = note;
    if (answerError != null) throw answerError!;
  }

  @override
  Future<GuideTourPublicDetail> fetchTourDetail(String tourId) async =>
      throw UnimplementedError();

  @override
  Future<GuideRoster> fetchRoster(String tourId) async =>
      throw UnimplementedError();

  @override
  Future<CheckInResult> checkIn({
    required String tourId,
    required String code,
  }) async => throw UnimplementedError();
}

GuideAssignedTour tour({
  required String id,
  required String status,
  DateTime? departure,
  int fee = 0,
}) {
  return GuideAssignedTour(
    id: id,
    title: 'Tour $id',
    destination: 'Hạ Long',
    durationDays: 3,
    tourStatus: 'PUBLISHED',
    assignmentStatus: status,
    feePerBooking: fee,
    nextDepartureDate: departure,
  );
}

void main() {
  test('splits pending and accepted tours, dropping declined ones', () async {
    final api = FakeToursApi(
      tours: [
        tour(id: 'p1', status: 'PENDING'),
        tour(id: 'a1', status: 'ACCEPTED'),
        tour(id: 'd1', status: 'DECLINED'),
      ],
    );
    final cubit = GuideToursCubit(api);

    await cubit.load();

    expect(cubit.state.pendingTours.map((item) => item.id), ['p1']);
    expect(cubit.state.upcomingTours.map((item) => item.id), ['a1']);
    expect(cubit.state.loading, isFalse);
  });

  test('sorts each tab by next departure, tours without a date last', () async {
    final api = FakeToursApi(
      tours: [
        tour(id: 'late', status: 'PENDING', departure: DateTime(2026, 12, 5)),
        tour(id: 'none', status: 'PENDING'),
        tour(id: 'soon', status: 'PENDING', departure: DateTime(2026, 12, 1)),
      ],
    );
    final cubit = GuideToursCubit(api);

    await cubit.load();

    expect(cubit.state.pendingTours.map((item) => item.id), [
      'soon',
      'late',
      'none',
    ]);
  });

  test('accepting moves the tour to upcoming without a reload', () async {
    final api = FakeToursApi(
      tours: [tour(id: 'p1', status: 'PENDING')],
    );
    final cubit = GuideToursCubit(api);
    await cubit.load();

    final outcome = await cubit.answer(
      tourId: 'p1',
      accept: true,
      note: 'Sẵn sàng',
    );

    expect(outcome, isA<GuideAnswerSuccess>());
    expect((outcome as GuideAnswerSuccess).tour.assignmentStatus, 'ACCEPTED');
    expect(api.answerCalls, 1);
    expect(api.lastAccept, isTrue);
    expect(api.lastNote, 'Sẵn sàng');
    expect(cubit.state.pendingTours, isEmpty);
    expect(cubit.state.upcomingTours.single.id, 'p1');
    expect(cubit.state.answering, isFalse);
  });

  test('declining removes the tour from both tabs', () async {
    final api = FakeToursApi(
      tours: [tour(id: 'p1', status: 'PENDING')],
    );
    final cubit = GuideToursCubit(api);
    await cubit.load();

    final outcome = await cubit.answer(
      tourId: 'p1',
      accept: false,
      note: 'Trùng lịch',
    );

    expect(outcome, isA<GuideAnswerSuccess>());
    expect(api.lastAccept, isFalse);
    expect(api.lastNote, 'Trùng lịch');
    expect(cubit.state.pendingTours, isEmpty);
    expect(cubit.state.upcomingTours, isEmpty);
  });

  test(
    'keeps the tour pending and maps the error when the API refuses',
    () async {
      final api = FakeToursApi(
        tours: [tour(id: 'p1', status: 'PENDING')],
        answerError: const GuideApiException(
          code: 'INVALID_STATE_TRANSITION',
          message: 'backend',
        ),
      );
      final cubit = GuideToursCubit(api);
      await cubit.load();

      final outcome = await cubit.answer(tourId: 'p1', accept: true);

      expect(outcome, isA<GuideAnswerFailure>());
      expect(
        (outcome as GuideAnswerFailure).message,
        'Phân công đã được xử lý trước đó. Vui lòng tải lại danh sách.',
      );
      expect(cubit.state.pendingTours.single.id, 'p1');
      expect(cubit.state.answering, isFalse);
    },
  );

  test('maps a backend error to Vietnamese', () async {
    final api = FakeToursApi(
      error: const GuideApiException(code: 'NETWORK_ERROR', message: ''),
    );
    final cubit = GuideToursCubit(api);

    await cubit.load();

    expect(
      cubit.state.error,
      'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.',
    );
  });
}
