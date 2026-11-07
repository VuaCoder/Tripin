import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/tours/bloc/tour_review_bloc.dart';
import 'package:mobile/features/tours/widgets/tour_review_form_modal.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('restores rating and text after closing, without leaking to another booking', (tester) async {
    SharedPreferences.setMockInitialValues({'tripri_user_id': 'traveler'});
    final bloc = TourReviewBloc();
    addTearDown(bloc.close);
    Widget form(String bookingId) => MaterialApp(
      home: Scaffold(
        body: BlocProvider.value(
          value: bloc,
          child: TourReviewFormModal(key: ValueKey(bookingId), bookingId: bookingId),
        ),
      ),
    );
    await tester.pumpWidget(form('booking-one'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), 'Chuyến đi rất đáng nhớ');
    await tester.tap(find.byIcon(Icons.star_rounded).at(2));
    // Closing immediately must flush the pending debounce.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    final prefs = await SharedPreferences.getInstance();
    final draft = jsonDecode(prefs.getString('review_draft_v1_traveler_booking-one')!) as Map;
    expect(draft['rating'], 3);
    expect(draft['comment'], 'Chuyến đi rất đáng nhớ');

    await tester.pumpWidget(form('booking-one'));
    await tester.pumpAndSettle();
    expect(find.text('Chuyến đi rất đáng nhớ'), findsOneWidget);
    expect(find.byIcon(Icons.star_rounded), findsNWidgets(3));
    await tester.pumpWidget(form('booking-two'));
    await tester.pumpAndSettle();
    expect(find.text('Chuyến đi rất đáng nhớ'), findsNothing);
    expect(find.byIcon(Icons.star_rounded), findsNWidgets(5));
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}
