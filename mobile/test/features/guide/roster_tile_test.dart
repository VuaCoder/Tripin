import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/guide/models/guide_models.dart';
import 'package:mobile/features/guide/widgets/roster_tile.dart';

GuideRosterItem rosterItem({bool checkedIn = false, DateTime? checkedInAt}) {
  return GuideRosterItem(
    ticketId: 'e1',
    bookingCode: 'TRP-ABCD2345',
    holderName: 'Nguyễn An',
    participants: 3,
    checkedIn: checkedIn,
    guests: const GuideGuestCounts(adults: 2, children: 1, infants: 0),
    contactPhone: '0901234567',
    notes: 'Dị ứng hải sản',
    departureDate: DateTime(2026, 12, 1),
    checkedInAt: checkedInAt,
  );
}

void main() {
  testWidgets('shows guest counts, phone, notes and the not-arrived status', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: RosterTile(item: rosterItem())),
      ),
    );

    expect(find.text('Nguyễn An'), findsOneWidget);
    expect(find.textContaining('2 người lớn · 1 trẻ em'), findsOneWidget);
    expect(find.text('Chưa đến'), findsOneWidget);
    expect(find.text('0901234567'), findsOneWidget);
    expect(find.text('Dị ứng hải sản'), findsOneWidget);
  });

  testWidgets('shows the check-in time when the group is on board', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RosterTile(
            item: rosterItem(
              checkedIn: true,
              checkedInAt: DateTime(2026, 12, 1, 8, 5),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Đã lên xe · 08:05'), findsOneWidget);
    expect(find.text('Chưa đến'), findsNothing);
  });
}
