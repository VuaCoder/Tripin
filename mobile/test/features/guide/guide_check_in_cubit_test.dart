import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/guide/api/guide_check_in_api.dart';
import 'package:mobile/features/guide/cubit/guide_check_in_cubit.dart';
import 'package:mobile/features/guide/models/guide_models.dart';

class FakeGuideCheckInApi implements GuideCheckInApi {
  FakeGuideCheckInApi({
    this.roster,
    this.tours = const [],
    this.checkInResult,
    this.checkInError,
    this.rosterError,
    this.checkInCompleter,
  });

  GuideRoster? roster;
  List<GuideAssignedTour> tours;
  CheckInResult? checkInResult;
  GuideApiException? checkInError;
  GuideApiException? rosterError;
  Completer<CheckInResult>? checkInCompleter;
  int checkInCalls = 0;
  String? lastCode;

  @override
  Future<List<GuideAssignedTour>> fetchAssignedTours() async => tours;

  @override
  Future<GuideRoster> fetchRoster(String tourId) async {
    if (rosterError != null) throw rosterError!;
    return roster ??
        const GuideRoster(tourId: 't1', tourTitle: 'Tour', total: 0, checkedIn: 0, items: []);
  }

  @override
  Future<CheckInResult> checkIn({required String tourId, required String code}) async {
    checkInCalls++;
    lastCode = code;
    if (checkInError != null) throw checkInError!;
    if (checkInCompleter != null) return checkInCompleter!.future;
    return checkInResult ??
        const CheckInResult(ticketId: 'e1', holderName: 'Ann', participants: 2, tourTitle: 'Tour');
  }
}

GuideRosterItem item({String id = 'e1', bool checkedIn = false}) {
  return GuideRosterItem(
    ticketId: id,
    bookingCode: 'TRP-ABCD2345',
    holderName: 'Ann',
    participants: 2,
    checkedIn: checkedIn,
  );
}

GuideRoster roster({List<GuideRosterItem>? items}) {
  final rows = items ?? [item()];
  return GuideRoster(
    tourId: 't1',
    tourTitle: 'Tour',
    total: rows.length,
    checkedIn: rows.where((row) => row.checkedIn).length,
    items: rows,
  );
}

void main() {
  group('loadRoster', () {
    test('stores the roster', () async {
      final api = FakeGuideCheckInApi(roster: roster(items: [item(), item(id: 'e2', checkedIn: true)]));
      final cubit = GuideCheckInCubit(api, 't1');

      await cubit.loadRoster();

      expect(cubit.state.loading, isFalse);
      expect(cubit.state.roster?.total, 2);
      expect(cubit.state.roster?.checkedIn, 1);
    });

    test('maps a backend error to Vietnamese', () async {
      final api = FakeGuideCheckInApi(rosterError: const GuideApiException(code: 'NOT_FOUND', message: ''));
      final cubit = GuideCheckInCubit(api, 't1');

      await cubit.loadRoster();

      expect(cubit.state.error, 'Tour không tồn tại hoặc bạn chưa được phân công.');
    });
  });

  group('checkIn', () {
    test('success updates the matching roster row and the counter', () async {
      final api = FakeGuideCheckInApi(
        roster: roster(items: [item(), item(id: 'e2')]),
        checkInResult: const CheckInResult(
          ticketId: 'e1',
          holderName: 'Ann',
          participants: 2,
          tourTitle: 'Tour',
        ),
      );
      final cubit = GuideCheckInCubit(api, 't1');
      await cubit.loadRoster();

      final outcome = await cubit.checkIn('  etk-aaaaaaaaaaaaaaaa ');

      expect(outcome, isA<CheckInSuccess>());
      expect(api.lastCode, 'etk-aaaaaaaaaaaaaaaa');
      expect(cubit.state.roster?.checkedIn, 1);
      expect(cubit.state.roster?.items.first.checkedIn, isTrue);
      expect(cubit.state.roster?.items[1].checkedIn, isFalse);
      expect(cubit.state.submitting, isFalse);
    });

    test('returns the mapped message for every known error code', () async {
      const expected = {
        'TICKET_NOT_FOUND': 'Mã vé không tồn tại hoặc không hợp lệ.',
        'TICKET_ALREADY_USED': 'Vé này đã được điểm danh trước đó.',
        'TICKET_WRONG_TOUR': 'Vé này thuộc tour khác, không thể điểm danh.',
        'TICKET_CANCELLED': 'Vé này đã bị hủy.',
        'NETWORK_ERROR': 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.',
      };

      for (final entry in expected.entries) {
        final api = FakeGuideCheckInApi(
          checkInError: GuideApiException(code: entry.key, message: 'backend text'),
        );
        final cubit = GuideCheckInCubit(api, 't1');
        await cubit.loadRoster();

        final outcome = await cubit.checkIn('ETK-AAAAAAAAAAAAAAAA');

        expect(outcome, isA<CheckInFailure>());
        expect((outcome as CheckInFailure).code, entry.key);
        expect(outcome.message, entry.value);
      }
    });

    test('rejects an empty code without calling the API', () async {
      final api = FakeGuideCheckInApi();
      final cubit = GuideCheckInCubit(api, 't1');
      await cubit.loadRoster();

      final outcome = await cubit.checkIn('   ');

      expect(outcome, isA<CheckInFailure>());
      expect(api.checkInCalls, 0);
    });

    test('ignores a second call while the first is still running', () async {
      final completer = Completer<CheckInResult>();
      final api = FakeGuideCheckInApi(checkInCompleter: completer);
      final cubit = GuideCheckInCubit(api, 't1');
      await cubit.loadRoster();

      final first = cubit.checkIn('ETK-AAAAAAAAAAAAAAAA');
      final second = await cubit.checkIn('ETK-BBBBBBBBBBBBBBBB');

      expect(second, isNull);
      completer.complete(
        const CheckInResult(ticketId: 'e1', holderName: 'Ann', participants: 2, tourTitle: 'Tour'),
      );
      await first;
    });
  });

  test('startTrip only works when every ticket is checked in', () async {
    final api = FakeGuideCheckInApi(roster: roster(items: [item(checkedIn: false)]));
    final cubit = GuideCheckInCubit(api, 't1');
    await cubit.loadRoster();

    cubit.startTrip();
    expect(cubit.state.tripStarted, isFalse);

    api.roster = roster(items: [item(checkedIn: true)]);
    await cubit.loadRoster();
    cubit.startTrip();

    expect(cubit.state.tripStarted, isTrue);
  });
}
