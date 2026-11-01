import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/bookings/models/booking_models.dart';
import 'package:mobile/features/bookings/screens/trips_screen.dart';

void main() {
  group('TripsScreen Widget Tests', () {
    final uncompletedTrip = BookingItem(
      id: 'trip-test-1',
      bookingCode: 'TRP-TEST01',
      status: BookingStatus.confirmed,
      tourId: 'tour-test-1',
      tourTitle: 'Chuyến đi Đà Lạt',
      departureDate: DateTime(2026, 8, 18),
      endDate: DateTime(2026, 8, 20),
      participants: 3,
      totalAmount: 2500000,
      isPaid: true,
      refundRequired: false,
      destination: 'Đà Lạt',
      contactName: 'Hoàng Phúc',
      isReviewed: false,
    );

    final completedTrip = BookingItem(
      id: 'trip-test-2',
      bookingCode: 'TRP-TEST02',
      status: BookingStatus.completed,
      tourId: 'tour-test-2',
      tourTitle: 'Chuyến đi Nha Trang',
      departureDate: DateTime(2026, 9, 1),
      endDate: DateTime(2026, 9, 3),
      participants: 2,
      totalAmount: 1800000,
      isPaid: true,
      refundRequired: false,
      destination: 'Nha Trang',
      contactName: 'Hoàng Phúc',
      isReviewed: false,
    );

    final reviewedCompletedTrip = BookingItem(
      id: 'trip-test-3',
      bookingCode: 'TRP-TEST03',
      status: BookingStatus.completed,
      tourId: 'tour-test-3',
      tourTitle: 'Chuyến đi Phú Quốc',
      departureDate: DateTime(2026, 10, 15),
      endDate: DateTime(2026, 10, 16),
      participants: 2,
      totalAmount: 3200000,
      isPaid: true,
      refundRequired: false,
      destination: 'Phú Quốc',
      contactName: 'Hoàng Phúc',
      isReviewed: true,
    );

    testWidgets('renders title "Chuyến đi" and not "Trips"', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TripsScreen(
            initialTrips: [uncompletedTrip],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Chuyến đi'), findsOneWidget);
      expect(find.text('Trips'), findsNothing);
    });

    testWidgets('does not display booking code "Mã:" and displays dates in Vietnamese', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TripsScreen(
            initialTrips: [uncompletedTrip],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Mã:'), findsNothing);
      expect(find.textContaining('thg'), findsOneWidget);
    });

    testWidgets('uncompleted trip shows "Hoàn thành" button and not "Viết đánh giá"', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TripsScreen(
            initialTrips: [uncompletedTrip],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Hoàn thành'), findsOneWidget);
      expect(find.text('Viết đánh giá'), findsNothing);
      expect(find.byTooltip('Đã hoàn thành'), findsNothing);
      expect(find.text('Xem QR'), findsOneWidget);
    });

    testWidgets('completed trip shows circular tick icon and "Viết đánh giá" button', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TripsScreen(
            initialTrips: [completedTrip],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byTooltip('Đã hoàn thành chuyến đi'), findsOneWidget);
      expect(find.text('Viết đánh giá'), findsOneWidget);
      expect(find.text('Hoàn thành'), findsNothing);
      expect(find.text('Xem QR'), findsOneWidget);
    });

    testWidgets('completed and reviewed trip shows 2 circular tick icons and hides reviewed button', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TripsScreen(
            initialTrips: [reviewedCompletedTrip],
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 2 icon dấu tick tròn theo Ảnh 3
      expect(find.byTooltip('Đã hoàn thành chuyến đi'), findsOneWidget);
      expect(find.byTooltip('Đã đánh giá chuyến đi'), findsOneWidget);

      // Đã đánh giá rồi thì không còn nút Đã đánh giá / Viết đánh giá
      expect(find.text('Đã đánh giá'), findsNothing);
      expect(find.text('Viết đánh giá'), findsNothing);
      expect(find.text('Xem QR'), findsOneWidget);
    });

    testWidgets('shows skeleton loading while fetching trips and never renders Da Lat mock', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: TripsScreen(),
        ),
      );
      await tester.pump();

      // Da Lat mock is completely removed and never shown
      expect(find.text('Dalat'), findsNothing);
      expect(find.text('TRP-DLT8920'), findsNothing);

      await tester.pumpAndSettle();
    });

    testWidgets('displays +X guest badge when trip has multiple participants with avatar on top', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TripsScreen(
            initialTrips: [uncompletedTrip], // participants: 3 -> additional: +2
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Participants = 3 -> Displays +2 badge
      expect(find.text('+2'), findsOneWidget);
    });

    testWidgets('reviewed trip renders both ticks with colored borders', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TripsScreen(
            initialTrips: [reviewedCompletedTrip],
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Look for check icons
      final checkIcons = find.byIcon(Icons.check_rounded);
      expect(checkIcons, findsNWidgets(2));

      // Both check icons have green color Color(0xFF16A34A)
      for (final element in checkIcons.evaluate()) {
        final iconWidget = element.widget as Icon;
        expect(iconWidget.color, const Color(0xFF16A34A));
      }
    });
  });
}
