import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/guide/api/guide_check_in_api.dart';
import 'package:mobile/features/guide/cubit/guide_tours_cubit.dart';
import 'package:mobile/features/guide/models/guide_models.dart';

class FakeToursApi implements GuideCheckInApi {
  FakeToursApi({this.tours = const [], this.error});

  final List<GuideAssignedTour> tours;
  final GuideApiException? error;

  @override
  Future<List<GuideAssignedTour>> fetchAssignedTours() async {
    if (error != null) throw error!;
    return tours;
  }

  @override
  Future<GuideRoster> fetchRoster(String tourId) async => throw UnimplementedError();

  @override
  Future<CheckInResult> checkIn({required String tourId, required String code}) async =>
      throw UnimplementedError();
}

GuideAssignedTour tour({required String id, required String status}) {
  return GuideAssignedTour(
    id: id,
    title: 'Tour $id',
    destination: 'Hạ Long',
    durationDays: 3,
    tourStatus: 'PUBLISHED',
    assignmentStatus: status,
  );
}

void main() {
  test('keeps only accepted assignments', () async {
    final api = FakeToursApi(tours: [
      tour(id: 't1', status: 'ACCEPTED'),
      tour(id: 't2', status: 'PENDING'),
      tour(id: 't3', status: 'DECLINED'),
    ]);
    final cubit = GuideToursCubit(api);

    await cubit.load();

    expect(cubit.state.tours.map((item) => item.id), ['t1']);
    expect(cubit.state.loading, isFalse);
  });

  test('maps a backend error to Vietnamese', () async {
    final api = FakeToursApi(error: const GuideApiException(code: 'NETWORK_ERROR', message: ''));
    final cubit = GuideToursCubit(api);

    await cubit.load();

    expect(cubit.state.error, 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
  });
}
