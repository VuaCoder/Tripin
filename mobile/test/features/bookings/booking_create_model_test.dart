import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/bookings/models/booking_create_model.dart';
import 'package:mobile/features/bookings/models/booking_voucher_model.dart';

void main() {
  group('[FLOW-09] BookingCreateModel Unit Tests', () {
    test('BookingContactModel serializes and trims fullName, phone and email', () {
      const contact = BookingContactModel(
        fullName: '   Nguyen Van B   ',
        phone: '  0901234567  ',
        email: '  test@example.com  ',
      );

      final json = contact.toJson();
      expect(json['fullName'], 'Nguyen Van B');
      expect(json['phone'], '0901234567');
      expect(json['email'], 'test@example.com');

      final fromJson = BookingContactModel.fromJson(json);
      expect(fromJson.fullName, 'Nguyen Van B');
      expect(fromJson.phone, '0901234567');
      expect(fromJson.email, 'test@example.com');
    });

    test('GuestCounts calculates total and serializes to json', () {
      const guests = GuestCounts(adults: 2, children: 1, infants: 1);
      expect(guests.total, 4);

      final json = guests.toJson();
      expect(json['adults'], 2);
      expect(json['children'], 1);
      expect(json['infants'], 1);

      final fromJson = GuestCounts.fromJson(json);
      expect(fromJson.adults, 2);
      expect(fromJson.children, 1);
      expect(fromJson.infants, 1);
      expect(fromJson.total, 4);
    });

    test('BookingCreateRequest generateClientRequestId generates valid regex token', () {
      final token = BookingCreateRequest.generateClientRequestId();
      expect(token.length, 32);
      final regex = RegExp(r'^[A-Za-z0-9_-]{8,64}$');
      expect(regex.hasMatch(token), isTrue);
    });

    test('BookingCreateRequest toJson omits empty optional fields and keeps uppercase promo codes', () {
      const contact = BookingContactModel(
        fullName: 'Tran Thi C',
        phone: '0987654321',
        email: 'tranthic@gmail.com',
      );
      const request = BookingCreateRequest(
        tourId: 'tour-123',
        departureId: 'dep-456',
        participants: 2,
        guestCounts: GuestCounts(adults: 2, children: 0, infants: 0),
        contact: contact,
        notes: '   Phòng hướng biển  ',
        promotionCode: 'summer2026',
        clientRequestId: 'req-unique-uuid-12345',
      );

      final json = request.toJson();
      expect(json['tourId'], 'tour-123');
      expect(json['departureId'], 'dep-456');
      expect(json['participants'], 2);
      expect(json['guestCounts']['adults'], 2);
      expect(json['contact']['fullName'], 'Tran Thi C');
      expect(json['notes'], contains('Phòng hướng biển'));
      expect(json['notes'], contains('Email khách: tranthic@gmail.com'));
      expect(json['promotionCode'], 'SUMMER2026');
      expect(json['clientRequestId'], 'req-unique-uuid-12345');
      expect(json.containsKey('agencyPromotionCode'), isFalse);
      expect(json.containsKey('platformPromotionCode'), isFalse);
    });

    test('BookingCreatedModel parses backend BookingDto correctly and formats currency', () {
      final json = {
        'id': 'booking-001',
        'bookingCode': 'TRP-9X8Y7Z',
        'status': 'PENDING',
        'tour': {
          'id': 'tour-001',
          'title': 'Khám phá Vịnh Hạ Long 3N2Đ',
        },
        'departureId': 'dep-001',
        'departureDate': '2026-11-15T08:00:00.000Z',
        'participants': 2,
        'unitPrice': 1500000,
        'subtotal': 3000000,
        'discountAmount': 300000,
        'totalAmount': 2700000,
        'contact': {
          'fullName': 'Le Van D',
          'phone': '0912345678',
        },
        'notes': 'Ăn chay',
        'isPaid': false,
        'paymentExpiresAt': '2026-11-01T15:00:00.000Z',
        'createdAt': '2026-11-01T14:45:00.000Z',
      };

      final model = BookingCreatedModel.fromJson(json);

      expect(model.id, 'booking-001');
      expect(model.bookingCode, 'TRP-9X8Y7Z');
      expect(model.status, 'PENDING');
      expect(model.tourTitle, 'Khám phá Vịnh Hạ Long 3N2Đ');
      expect(model.participants, 2);
      expect(model.unitPrice, 1500000);
      expect(model.subtotal, 3000000);
      expect(model.discountAmount, 300000);
      expect(model.totalAmount, 2700000);
      expect(model.contactName, 'Le Van D');
      expect(model.contactPhone, '0912345678');
      expect(model.isPaid, isFalse);

      expect(model.formattedTotalAmount, '2.700.000 ₫');
      expect(model.formattedSubtotal, '3.000.000 ₫');
      expect(model.formattedDiscountAmount, '300.000 ₫');
      expect(model.formattedDepartureDate, isNotEmpty);
      expect(model.formattedPaymentExpiresAt, isNotEmpty);
    });

    test('BookingCreatedModel fallback values for missing optional fields', () {
      final json = {
        'id': 'booking-empty',
        'bookingCode': 'TRP-EMPTY',
        'status': 'PENDING',
        'participants': 1,
        'unitPrice': 500000,
        'subtotal': 500000,
        'discountAmount': 0,
        'totalAmount': 500000,
        'contact': {
          'fullName': 'Nguyen E',
          'phone': '0901112222',
        },
      };

      final model = BookingCreatedModel.fromJson(json);
      expect(model.departureId, isEmpty);
      expect(model.departureDate, isNull);
      expect(model.endDate, isNull);
      expect(model.notes, isNull);
      expect(model.paymentExpiresAt, isNull);
      expect(model.formattedDepartureDate, isEmpty);
      expect(model.formattedPaymentExpiresAt, '15 phút kể từ lúc đặt');
    });
  });

  group('[FLOW-09] BookingVoucherModel Unit Tests', () {
    test('VoucherItemModel parses from UserVoucherDto with nested promotion map', () {
      final json = {
        'id': 'user-voucher-1',
        'isUsed': false,
        'promotion': {
          'id': 'promo-1',
          'code': 'SUMMER50',
          'title': 'Giảm giá hè 50K',
          'discountType': 'FIXED',
          'discountValue': 50000,
          'minOrderAmount': 200000,
          'scope': 'PLATFORM',
          'isActive': true,
        }
      };

      final voucher = VoucherItemModel.fromJson(json);
      expect(voucher.id, 'user-voucher-1');
      expect(voucher.code, 'SUMMER50');
      expect(voucher.title, 'Giảm giá hè 50K');
      expect(voucher.discountType, 'FIXED');
      expect(voucher.discountValue, 50000);
      expect(voucher.minOrderAmount, 200000);
      expect(voucher.formattedDiscountText, 'Giảm 50.000 ₫');
      expect(voucher.formattedMinOrderText, 'Đơn tối thiểu 200.000 ₫');
      expect(voucher.isApplicable(300000), isTrue);
      expect(voucher.isApplicable(100000), isFalse);
    });

    test('VoucherItemModel handles percent discount with maxDiscountAmount', () {
      final json = {
        'id': 'promo-percent',
        'code': 'VIP10',
        'title': 'Giảm 10% tối đa 100K',
        'discountType': 'PERCENT',
        'discountValue': 10,
        'maxDiscountAmount': 100000,
        'minOrderAmount': 0,
        'scope': 'PLATFORM',
        'isActive': true,
      };

      final voucher = VoucherItemModel.fromJson(json);
      expect(voucher.formattedDiscountText, 'Giảm 10% (tối đa 100.000 ₫)');
      expect(voucher.formattedMinOrderText, 'Không giới hạn đơn tối thiểu');
    });

    test('PromotionPreviewResult parses preview response correctly', () {
      final json = {
        'promotionId': 'promo-1',
        'code': 'HELLO2026',
        'scope': 'PLATFORM',
        'discountAmount': 120000,
        'finalAmount': 880000,
      };

      final preview = PromotionPreviewResult.fromJson(json);
      expect(preview.promotionId, 'promo-1');
      expect(preview.code, 'HELLO2026');
      expect(preview.discountAmount, 120000);
      expect(preview.finalAmount, 880000);
    });
  });
}
