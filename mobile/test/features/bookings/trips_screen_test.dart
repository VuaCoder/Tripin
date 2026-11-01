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
      expect(find.text('Đã hoàn thành'), findsNothing);
      expect(find.text('Xem QR'), findsOneWidget);
    });

    testWidgets('completed trip shows "Đã hoàn thành" badge and "Viết đánh giá" button', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: TripsScreen(
            initialTrips: [completedTrip],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Đã hoàn thành'), findsOneWidget);
      expect(find.text('Viết đánh giá'), findsOneWidget);
      expect(find.text('Hoàn thành'), findsNothing);
      expect(find.text('Xem QR'), findsOneWidget);
    });
  });
}
