import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/bookings/models/booking_create_model.dart';
import 'package:mobile/features/bookings/models/booking_voucher_model.dart';

void main() {
  group('[FLOW-09] BookingCreateModel Unit Tests', () {
    test('BookingContactModel serializes and trims fullName and phone', () {
      const contact = BookingContactModel(
        fullName: '   Nguyen Van B   ',
        phone: '  0901234567  ',
      );

      final json = contact.toJson();
      expect(json['fullName'], 'Nguyen Van B');
      expect(json['phone'], '0901234567');

      final fromJson = BookingContactModel.fromJson(json);
      expect(fromJson.fullName, 'Nguyen Van B');
      expect(fromJson.phone, '0901234567');
    });

    test('BookingCreateRequest generateClientRequestId generates valid regex token', () {
      final token = BookingCreateRequest.generateClientRequestId();
      expect(token.length, 32);
      final regex = RegExp(r'^[A-Za-z0-9_-]{8,64}$');
      expect(regex.hasMatch(token), isTrue);
    });

    test('BookingCreateRequest toJson omits empty optional fields and keeps uppercase promo codes', () {
      const contact = BookingContactModel(fullName: 'Tran Thi C', phone: '0987654321');
      const request = BookingCreateRequest(
        tourId: 'tour-123',
        departureId: 'dep-456',
        participants: 2,
        contact: contact,
        notes: '   Phòng hướng biển  ',
        promotionCode: 'summer2026',
        clientRequestId: 'req-unique-uuid-12345',
      );

      final json = request.toJson();
      expect(json['tourId'], 'tour-123');
      expect(json['departureId'], 'dep-456');
      expect(json['participants'], 2);
      expect(json['contact']['fullName'], 'Tran Thi C');
      expect(json['notes'], 'Phòng hướng biển');
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

    test('BookingCreatedModel handles missing nested maps and null values safely', () {
      final json = <String, dynamic>{
        'id': 'booking-002',
        'bookingCode': 'TRP-EMPTY',
      };

      final model = BookingCreatedModel.fromJson(json);
      expect(model.id, 'booking-002');
      expect(model.bookingCode, 'TRP-EMPTY');
      expect(model.status, 'PENDING');
      expect(model.tourTitle, 'Chuyến du lịch');
      expect(model.totalAmount, 0);
      expect(model.contactName, '');
      expect(model.contactPhone, '');
      expect(model.paymentExpiresAt, isNull);
    });
  });

  group('[FLOW-09] BookingVoucherModel Unit Tests', () {
    test('VoucherItemModel parses from UserVoucherDto with nested promotion map', () {
      final json = {
        'id': 'uv-001',
        'isUsed': false,
        'promotion': {
          'id': 'promo-101',
          'code': 'SUMMER10',
          'title': 'Ưu đãi hè rực rỡ',
          'discountType': 'PERCENT',
          'discountValue': 10,
          'maxDiscountAmount': 200000,
          'minOrderAmount': 1000000,
          'scope': 'PLATFORM',
          'isActive': true,
          'endsAt': '2026-12-31T23:59:59.000Z',
        },
      };

      final voucher = VoucherItemModel.fromJson(json);
      expect(voucher.code, 'SUMMER10');
      expect(voucher.discountType, 'PERCENT');
      expect(voucher.discountValue, 10);
      expect(voucher.maxDiscountAmount, 200000);
      expect(voucher.minOrderAmount, 1000000);
      expect(voucher.isUsed, isFalse);
      expect(voucher.isActive, isTrue);

      expect(voucher.formattedDiscountText, 'Giảm 10% (tối đa 200.000 ₫)');
      expect(voucher.formattedMinOrderText, 'Đơn tối thiểu 1.000.000 ₫');

      // Check applicability against order subtotal
      expect(voucher.isApplicable(500000), isFalse);
      expect(voucher.isApplicable(1500000), isTrue);
    });

    test('VoucherItemModel fixed discount formatting and expired check', () {
      final voucher = VoucherItemModel(
        id: 'promo-fixed',
        code: 'GIAM50K',
        title: 'Giảm ngay 50K',
        discountType: 'FIXED',
        discountValue: 50000,
        minOrderAmount: 0,
        scope: 'AGENCY',
        endsAt: DateTime.now().subtract(const Duration(days: 1)),
      );

      expect(voucher.formattedDiscountText, 'Giảm 50.000 ₫');
      expect(voucher.formattedMinOrderText, 'Không giới hạn đơn tối thiểu');
      expect(voucher.isExpired, isTrue);
      expect(voucher.isApplicable(200000), isFalse);
    });

    test('PromotionPreviewResult parses backend preview envelope properly', () {
      final json = {
        'promotionId': 'p-123',
        'code': 'SAVE100',
        'scope': 'AGENCY',
        'discountAmount': 100000,
        'finalAmount': 900000,
      };

      final preview = PromotionPreviewResult.fromJson(json);
      expect(preview.promotionId, 'p-123');
      expect(preview.code, 'SAVE100');
      expect(preview.scope, 'AGENCY');
      expect(preview.discountAmount, 100000);
      expect(preview.finalAmount, 900000);
    });
  });
}

