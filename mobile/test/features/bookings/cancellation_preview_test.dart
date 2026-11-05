import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/bookings/models/booking_models.dart';

BookingItem _booking(BookingStatus status, DateTime departure, {int total = 2000000}) => BookingItem(
      id: 'b1',
      bookingCode: 'TRP-AAAA1111',
      status: status,
      tourId: 't1',
      tourTitle: 'Tour',
      departureDate: departure,
      endDate: departure.add(const Duration(days: 2)),
      participants: 2,
      totalAmount: total,
      isPaid: status != BookingStatus.pending,
      refundRequired: false,
    );

void main() {
  final now = DateTime.utc(2026, 11, 1, 8);

  test('CONFIRMED far from departure refunds the full amount (AC4)', () {
    final p = CancellationPreview.forBooking(
      _booking(BookingStatus.confirmed, now.add(const Duration(days: 10))),
      windowHours: 24,
      now: now,
    );
    expect(p.canCancel, isTrue);
    expect(p.refundAmount, 2000000);
    expect(p.penaltyAmount, 0);
    expect(p.daysLeft, 10);
  });

  test('CONFIRMED inside the window cannot be cancelled, matching backend', () {
    final p = CancellationPreview.forBooking(
      _booking(BookingStatus.confirmed, now.add(const Duration(hours: 23))),
      windowHours: 24,
      now: now,
    );
    expect(p.canCancel, isFalse);
    expect(p.refundAmount, 0);
  });

  test('exactly at the window boundary is still cancellable (backend blocks only hoursLeft < window)', () {
    final p = CancellationPreview.forBooking(
      _booking(BookingStatus.confirmed, now.add(const Duration(hours: 24))),
      windowHours: 24,
      now: now,
    );
    expect(p.canCancel, isTrue);
  });

  test('PENDING is always cancellable with no refund', () {
    final p = CancellationPreview.forBooking(
      _booking(BookingStatus.pending, now.add(const Duration(hours: 1))),
      windowHours: 24,
      now: now,
    );
    expect(p.canCancel, isTrue);
    expect(p.refundAmount, 0);
  });

  test('BookingItem.fromJson parses the backend DTO', () {
    final b = BookingItem.fromJson({
      'id': 'b1',
      'bookingCode': 'TRP-X',
      'status': 'CANCELLED',
      'tour': {'id': 't', 'title': 'Hạ Long'},
      'departureDate': '2026-12-01T00:00:00.000Z',
      'endDate': '2026-12-03T00:00:00.000Z',
      'participants': 3,
      'totalAmount': 900000,
      'isPaid': true,
      'refundRequired': true,
    });
    expect(b.status, BookingStatus.cancelled);
    expect(b.tourTitle, 'Hạ Long');
    expect(b.refundRequired, isTrue);
  });
}
