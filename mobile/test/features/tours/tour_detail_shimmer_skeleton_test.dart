import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/tours/widgets/tour_detail_shimmer_skeleton.dart';

void main() {
  group('TourDetailShimmerSkeleton Widget Tests', () {
    testWidgets('renders shimmer components matching 1:1 tour detail layout', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TourDetailShimmerSkeleton(),
          ),
        ),
      );
      await tester.pump();

      // Top floating header with Back and Heart icon buttons
      expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);
      expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);

      // Shimmer animation widget and boxes are present
      expect(find.byType(TourDetailShimmerSkeleton), findsOneWidget);
      expect(find.byType(ShimmerBox), findsWidgets);
    });
  });
}
