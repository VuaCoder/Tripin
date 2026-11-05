import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/tours/models/tour_detail_model.dart';

void main() {
  group('[FLOW-07] TourDetailModel & Related Models Unit Tests', () {
    test('parses full JSON into TourDetailModel with correct fields and types', () {
      final json = {
        'id': 'tour-123',
        'title': 'Khám phá Vịnh Hạ Long',
        'summary': 'Chuyến đi 3 ngày 2 đêm',
        'destination': 'Quảng Ninh',
        'durationDays': 3,
        'basePrice': 3490000,
        'coverImage': 'https://example.com/cover.jpg',
        'images': [
          'https://example.com/cover.jpg',
          'https://example.com/img1.jpg',
        ],
        'ratingAvg': 4.8,
        'ratingCount': 120,
        'description': 'Mô tả chi tiết chuyến đi...',
        'maxGroupSize': 20,
        'inclusions': ['Xe đưa đón', 'Khách sạn 4 sao', 'Bữa ăn theo chương trình'],
        'exclusions': ['Vé máy bay', 'Chi phí cá nhân'],
        'cancellationPolicy': 'Hủy trước 7 ngày hoàn 100%',
        'travelNotes': 'Mang theo kem chống nắng',
        'requiredDocuments': 'CCCD hoặc Hộ chiếu còn hạn',
        'childPricingPolicy': 'Trẻ dưới 5 tuổi miễn phí',
        'categories': [
          {'id': 'cat-1', 'name': 'Biển đảo'},
        ],
        'itinerary': [
          {
            'day': 2,
            'title': 'Khám phá Hang Sửng Sốt',
            'description': 'Tham quan một trong những hang động đẹp nhất',
            'activities': ['Chèo kayak', 'Tắm biển Ti Tốp'],
          },
          {
            'day': 1,
            'title': 'Hà Nội - Hạ Long',
            'description': 'Đón khách và lên du thuyền',
            'activities': ['Đón khách tại phố cổ', 'Thưởng thức bữa trưa hải sản'],
          },
        ],
        'departures': [
          {
            'id': 'dep-2',
            'date': DateTime.now().add(const Duration(days: 10)).toIso8601String(),
            'capacity': 20,
            'remaining': 5,
            'price': 3690000,
            'isOpen': true,
          },
          {
            'id': 'dep-1',
            'date': DateTime.now().add(const Duration(days: 3)).toIso8601String(),
            'capacity': 20,
            'remaining': 0,
            'price': 3490000,
            'isOpen': true,
          },
        ],
        'agency': {
          'id': 'agency-1',
          'name': 'Hạ Long Travel',
          'avatarUrl': 'https://example.com/agency.png',
        },
        'guide': {
          'id': 'guide-1',
          'fullName': 'Nguyễn Văn A',
          'avatarUrl': 'https://example.com/guide.png',
        },
      };

      final model = TourDetailModel.fromJson(json);

      expect(model.id, 'tour-123');
      expect(model.title, 'Khám phá Vịnh Hạ Long');
      expect(model.summary, 'Chuyến đi 3 ngày 2 đêm');
      expect(model.destination, 'Quảng Ninh');
      expect(model.durationDays, 3);
      expect(model.basePrice, 3490000);
      expect(model.ratingAvg, 4.8);
      expect(model.ratingCount, 120);
      expect(model.images.length, 2);
      expect(model.inclusions.length, 3);
      expect(model.exclusions.length, 2);
      expect(model.categories.first.name, 'Biển đảo');
      expect(model.agency?.name, 'Hạ Long Travel');
      expect(model.guide?.fullName, 'Nguyễn Văn A');

      // Test itinerary auto-sorted by day ascending
      expect(model.itinerary.length, 2);
      expect(model.itinerary.first.day, 1);
      expect(model.itinerary.first.title, 'Hà Nội - Hạ Long');
      expect(model.itinerary.last.day, 2);
      expect(model.itinerary.last.title, 'Khám phá Hang Sửng Sốt');

      // Test departures auto-sorted by date ascending
      expect(model.departures.length, 2);
      expect(model.departures.first.id, 'dep-1');
      expect(model.departures.last.id, 'dep-2');
    });

    test('handles missing, null and empty fields gracefully without throwing errors', () {
      final json = <String, dynamic>{
        'id': 'tour-empty',
        'title': 'Tour tối giản',
        // All other fields omitted
      };

      final model = TourDetailModel.fromJson(json);

      expect(model.id, 'tour-empty');
      expect(model.title, 'Tour tối giản');
      expect(model.destination, '');
      expect(model.durationDays, 1);
      expect(model.basePrice, 0);
      expect(model.ratingAvg, 0.0);
      expect(model.ratingCount, 0);
      expect(model.images, isEmpty);
      expect(model.inclusions, isEmpty);
      expect(model.exclusions, isEmpty);
      expect(model.itinerary, isEmpty);
      expect(model.departures, isEmpty);
      expect(model.agency, isNull);
      expect(model.guide, isNull);
    });

    test('TourDepartureModel evaluates isBookable correctly based on status, remaining and date', () {
      // Future date, open, has seats -> bookable
      final bookableDep = TourDepartureModel(
        id: 'dep-ok',
        date: DateTime.now().add(const Duration(days: 5)),
        capacity: 20,
        remaining: 8,
        price: 2000000,
        isOpen: true,
      );
      expect(bookableDep.isBookable, isTrue);

      // Remaining seats = 0 -> not bookable
      final soldOutDep = TourDepartureModel(
        id: 'dep-sold-out',
        date: DateTime.now().add(const Duration(days: 5)),
        capacity: 20,
        remaining: 0,
        price: 2000000,
        isOpen: true,
      );
      expect(soldOutDep.isBookable, isFalse);

      // isOpen = false -> not bookable
      final closedDep = TourDepartureModel(
        id: 'dep-closed',
        date: DateTime.now().add(const Duration(days: 5)),
        capacity: 20,
        remaining: 10,
        price: 2000000,
        isOpen: false,
      );
      expect(closedDep.isBookable, isFalse);

      // Date in the past -> not bookable
      final pastDep = TourDepartureModel(
        id: 'dep-past',
        date: DateTime.now().subtract(const Duration(days: 2)),
        capacity: 20,
        remaining: 10,
        price: 2000000,
        isOpen: true,
      );
      expect(pastDep.isBookable, isFalse);
    });

    test('TourItineraryDayModel correctly parses day range with toDay and activities list', () {
      final json = {
        'day': 3,
        'toDay': 4,
        'title': 'Trekking rừng nguyên sinh',
        'activities': ['Khởi hành sáng sớm', 'Cắm trại qua đêm'],
      };

      final dayModel = TourItineraryDayModel.fromJson(json);
      expect(dayModel.day, 3);
      expect(dayModel.toDay, 4);
      expect(dayModel.title, 'Trekking rừng nguyên sinh');
      expect(dayModel.activities.length, 2);
    });
  });
}

