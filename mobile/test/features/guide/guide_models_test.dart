import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/guide/models/guide_models.dart';

void main() {
  test(
    'bookedSeatsFor matches the departure date and subtracts remaining seats',
    () {
      final detail = GuideTourPublicDetail.fromJson({
        'maxGroupSize': 20,
        'description': '  Mô tả  ',
        'departures': [
          {'date': '2026-12-01T00:00:00.000Z', 'capacity': 20, 'remaining': 15},
          {'date': '2026-12-05T00:00:00.000Z', 'capacity': 20, 'remaining': 20},
        ],
      });

      expect(detail.description, 'Mô tả');
      expect(detail.maxGroupSize, 20);
      expect(detail.bookedSeatsFor(DateTime.utc(2026, 12, 1)), 5);
      expect(detail.bookedSeatsFor(DateTime.utc(2026, 12, 2)), isNull);
      expect(detail.bookedSeatsFor(null), isNull);
    },
  );

  test('a departure cannot report more booked seats than its capacity', () {
    final departure = GuideDepartureInfo.fromJson({
      'capacity': 10,
      'remaining': -3,
    });

    expect(departure.booked, 10);
  });
}
