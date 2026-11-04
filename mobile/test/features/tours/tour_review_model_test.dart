import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/tours/models/tour_review_model.dart';

void main() {
  group('[FLOW-08] TourReviewModel Unit Tests', () {
    test('parses full JSON into TourReviewModel with author and images', () {
      final json = {
        'id': 'rev-101',
        'rating': 5,
        'comment': 'Chuyến đi trên cả tuyệt vời, dịch vụ chu đáo!',
        'images': [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
        ],
        'tourId': 'tour-01',
        'author': {
          'name': 'Trần B.',
          'avatarUrl': 'https://example.com/avatar.jpg',
        },
        'createdAt': '2026-10-25T14:30:00.000Z',
      };

      final review = TourReviewModel.fromJson(json);

      expect(review.id, 'rev-101');
      expect(review.rating, 5);
      expect(review.comment, 'Chuyến đi trên cả tuyệt vời, dịch vụ chu đáo!');
      expect(review.images.length, 2);
      expect(review.tourId, 'tour-01');
      expect(review.author.name, 'Trần B.');
      expect(review.author.avatarUrl, 'https://example.com/avatar.jpg');
      expect(review.createdAt.year, 2026);
    });

    test('handles missing author and empty images gracefully without throwing', () {
      final json = <String, dynamic>{
        'id': 'rev-minimal',
        'rating': 4,
        'comment': 'Tour ổn áp, đáng tiền',
        'tourId': 'tour-01',
      };

      final review = TourReviewModel.fromJson(json);

      expect(review.id, 'rev-minimal');
      expect(review.rating, 4);
      expect(review.comment, 'Tour ổn áp, đáng tiền');
      expect(review.images, isEmpty);
      expect(review.author.name, 'Khách du lịch');
      expect(review.author.avatarUrl, isNull);
    });

    test('parses TourReviewPageModel with pagination metadata correctly', () {
      final pageJson = {
        'success': true,
        'data': [
          {
            'id': 'rev-1',
            'rating': 5,
            'comment': 'Rất đáng trải nghiệm!',
            'tourId': 'tour-01',
            'author': {'name': 'Lê C.'},
            'createdAt': '2026-10-20T08:00:00.000Z',
          },
          {
            'id': 'rev-2',
            'rating': 4,
            'comment': 'Ăn uống ngon, cảnh đẹp',
            'tourId': 'tour-01',
            'author': {'name': 'Phạm D.'},
            'createdAt': '2026-10-21T09:00:00.000Z',
          },
        ],
        'meta': {
          'page': 1,
          'limit': 2,
          'total': 5,
          'totalPages': 3,
        },
      };

      final page = TourReviewPageModel.fromJson(pageJson);

      expect(page.items.length, 2);
      expect(page.page, 1);
      expect(page.limit, 2);
      expect(page.total, 5);
      expect(page.totalPages, 3);
      expect(page.hasMore, isTrue);
    });

    test('CreateReviewRequest serializes to JSON correctly with trimmed comment', () {
      const request = CreateReviewRequest(
        bookingId: 'booking-uuid-123',
        rating: 5,
        comment: '  Một trải nghiệm khó quên tại miền Trung!  ',
      );

      final json = request.toJson();

      expect(json['bookingId'], 'booking-uuid-123');
      expect(json['rating'], 5);
      expect(json['comment'], 'Một trải nghiệm khó quên tại miền Trung!');
      expect(json.containsKey('imagePublicIds'), isFalse);
    });
  });
}

