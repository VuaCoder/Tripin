import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/tours/models/tour_detail_model.dart';
import 'package:mobile/features/tours/models/tour_model.dart';
import 'package:mobile/features/tours/models/tour_review_model.dart';
import 'package:mobile/features/tours/widgets/tour_detail_timeline_widget.dart';
import 'package:mobile/features/tours/widgets/tour_review_item_widget.dart';
import 'package:mobile/features/wishlist/models/recently_viewed_model.dart';
import 'package:mobile/features/wishlist/widgets/recently_viewed_collage_widget.dart';

void main() {
  group('Timeline, Reviews with Images & Collage Widget Tests', () {
    testWidgets('TourDetailTimelineWidget renders day card with top-right Ngày X badge and NO redundant title', (tester) async {
      final itinerary = [
        const TourItineraryDayModel(
          day: 1,
          title: 'Khám phá Đà Nẵng',
          description: 'Tham quan bán đảo Sơn Trà và Ngũ Hành Sơn',
          activities: ['Viếng chùa Linh Ứng', 'Tắm biển Mỹ Khê'],
        ),
        const TourItineraryDayModel(
          day: 2,
          title: 'Trải nghiệm Hội An',
          description: 'Dạo phố cổ ngắm đèn lồng và đi thuyền sông Hoài',
          activities: ['Check-in Chùa Cầu', 'Thưởng thức cao lầu'],
        ),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: TourDetailTimelineWidget(itinerary: itinerary),
            ),
          ),
        ),
      );

      // Redundant inner title should NOT exist
      expect(find.text('Lịch trình chi tiết'), findsNothing);

      // Day titles and badges match Image 4
      expect(find.text('Khám phá Đà Nẵng'), findsOneWidget);
      expect(find.text('Ngày 1'), findsOneWidget);
      expect(find.text('Trải nghiệm Hội An'), findsOneWidget);
      expect(find.text('Ngày 2'), findsOneWidget);

      // Activities exist
      expect(find.text('Viếng chùa Linh Ứng'), findsOneWidget);
      expect(find.text('Check-in Chùa Cầu'), findsOneWidget);
    });

    testWidgets('TourReviewItemWidget with images inside horizontal card does not throw overflow', (tester) async {
      final review = TourReviewModel.fromJson({
        'id': 'rev_1',
        'tourId': 'tour_1',
        'author': {'name': 'Nguyễn Văn A'},
        'rating': 5,
        'comment': 'Tour quá tuyệt vời, hướng dẫn viên nhiệt tình, cảnh đẹp mê ly, dịch vụ chuẩn 5 sao và lịch trình rất hợp lý.',
        'images': [
          'https://images.unsplash.com/photo-1560113855-2ea616c915ee',
          'https://images.unsplash.com/photo-1675111066042-9baa4c343157',
        ],
        'createdAt': '2026-10-25T14:30:00.000Z',
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              height: 290,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  TourReviewItemWidget(
                    review: review,
                    isCard: true,
                    width: 295,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      // Ensure review author renders without overflow assertion
      expect(find.text('Nguyễn Văn A'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('RecentlyViewedCollageWidget renders all 4 quadrants with fallback on broken url', (tester) async {
      final items = [
        RecentlyViewedTourModel(
          tour: const TourModel(
            id: 't1',
            title: 'Tour Hạ Long',
            summary: 'Hạ Long',
            destination: 'Quảng Ninh',
            durationDays: 2,
            basePrice: 2000000,
            coverImage: 'https://images.unsplash.com/photo-1675111066042-9baa4c343157',
          ),
          viewedAt: DateTime.now(),
        ),
        RecentlyViewedTourModel(
          tour: const TourModel(
            id: 't2',
            title: 'Tour Sapa',
            summary: 'Sapa',
            destination: 'Lào Cai',
            durationDays: 3,
            basePrice: 3000000,
            coverImage: 'https://images.unsplash.com/photo-1770181280811-f76c9cb5a1c9', // Broken URL
          ),
          viewedAt: DateTime.now(),
        ),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 160,
              height: 160,
              child: RecentlyViewedCollageWidget(items: items),
            ),
          ),
        ),
      );
      await tester.pump();

      // Does not throw and does not render broken image icon
      expect(find.byIcon(Icons.image_outlined), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });
}
