import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/guide/models/guide_models.dart';
import 'package:mobile/features/guide/cubit/guide_tours_cubit.dart';

void main() {
  test(
    'filters individual departures of the same tour without collapsing history into its next departure',
    () {
      final now = DateTime.now();
      GuideAssignedTour departure(String id, int startHours, int endHours) =>
          GuideAssignedTour(
            id: 'same-tour',
            departureId: id,
            title: 'Tour',
            destination: 'Place',
            durationDays: 2,
            tourStatus: 'APPROVED',
            assignmentStatus: 'ACCEPTED',
            nextDepartureDate: now.add(Duration(hours: startHours)),
            endDate: now.add(Duration(hours: endHours)),
          );
      final state = GuideToursState(
        tours: [
          departure('past', -50, -2),
          departure('current', -2, 20),
          departure('future', 24, 72),
        ],
      );
      expect(state.upcomingTours.single.departureId, 'future');
      expect(state.ongoingTours.single.departureId, 'current');
      expect(state.completedTours.single.departureId, 'past');
    },
  );
}
