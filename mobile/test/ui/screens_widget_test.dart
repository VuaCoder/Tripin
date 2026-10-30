import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/bookings/bloc/bookings_repository.dart';
import 'package:mobile/features/bookings/models/booking_models.dart';
import 'package:mobile/features/bookings/screens/cancel_booking_screen.dart';
import 'package:mobile/features/bookings/screens/e_ticket_screen.dart';
import 'package:mobile/features/payments/bloc/payments_repository.dart';
import 'package:mobile/features/payments/models/payment_models.dart';
import 'package:mobile/features/payments/screens/payment_screen.dart';
import 'package:qr_flutter/qr_flutter.dart';

class _PayRepo extends PaymentsRepository {
  final DateTime expiresAt;
  _PayRepo(this.expiresAt);

  @override
  Future<CheckoutInfo> createCheckout(String bookingId) async => CheckoutInfo(
        paymentId: 'p1',
        checkoutUrl: 'https://pay.example/p1',
        amount: 500000,
        expiresAt: expiresAt,
        bankTransfer: const BankTransferInfo(
          qrCode: '000201010212',
          accountNumber: '0123456789',
          accountName: 'TRIPRI',
          bin: '970422',
          description: 'TRP12345',
        ),
      );

  @override
  Future<PaymentSnapshot> getPayment(String paymentId) async =>
      PaymentSnapshot(id: paymentId, status: PaymentStatus.pending, expiresAt: expiresAt);
}

BookingItem _booking({BookingStatus status = BookingStatus.confirmed, Duration departIn = const Duration(days: 10)}) => BookingItem(
      id: 'b1',
      bookingCode: 'TRP-1',
      status: status,
      tourId: 't1',
      tourTitle: 'Hạ Long 2N1Đ',
      departureDate: DateTime.now().add(departIn),
      endDate: DateTime.now().add(departIn + const Duration(days: 1)),
      participants: 2,
      totalAmount: 2000000,
      isPaid: true,
      refundRequired: false,
    );

class _BookingRepo extends BookingsRepository {
  final ETicketStatus ticketStatus;
  _BookingRepo({this.ticketStatus = ETicketStatus.valid});

  @override
  Future<TicketResult> getTicketForBooking(String bookingId) async => TicketResult(ETicket(
        id: 'e1',
        code: 'ETK-ABCDEFGH12345678',
        status: ticketStatus,
        bookingId: bookingId,
        bookingCode: 'TRP-1',
        tourTitle: 'Hạ Long 2N1Đ',
        departureDate: DateTime.now().add(const Duration(days: 10)),
        participants: 2,
        holderName: 'Nguyen Van A',
        destination: 'Quảng Ninh',
        meetingPoint: 'Bến Tuần Châu',
      ));

  @override
  Future<int> getCancellationWindowHours() async => 24;
}

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 3000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async => null);
  });

  testWidgets('payment screen shows countdown, bank info and copy feedback (AC3)', (tester) async {
    _tall(tester);
    await tester.pumpWidget(MaterialApp(
      home: PaymentScreen(bookingId: 'b1', repository: _PayRepo(DateTime.now().add(const Duration(minutes: 15)))),
    ));
    await tester.pump();
    await tester.pump();

    expect(find.byKey(const Key('countdown')), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.text('0123456789'), findsOneWidget);
    expect(find.text('TRP12345'), findsOneWidget);
    expect(find.text('Mở ứng dụng ngân hàng'), findsOneWidget);

    await tester.tap(find.byTooltip('Sao chép Số tài khoản'));
    await tester.pump();
    expect(find.text('Đã sao chép'), findsOneWidget);

    await tester.pumpWidget(const SizedBox()); // dispose: stops timers
  });

  testWidgets('payment screen explains expiry and offers a new order (AC5)', (tester) async {
    _tall(tester);
    await tester.pumpWidget(MaterialApp(
      home: PaymentScreen(bookingId: 'b1', repository: _PayRepo(DateTime.now().subtract(const Duration(seconds: 1)))),
    ));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump();
    await tester.pump();

    expect(find.text('Đơn đã hết hạn thanh toán'), findsOneWidget);
    expect(find.text('Tạo đơn mới'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('e-ticket shows code, meeting point, QR and cancel button (AC2)', (tester) async {
    _tall(tester);
    await tester.pumpWidget(MaterialApp(home: ETicketScreen(booking: _booking(), repository: _BookingRepo())));
    await tester.pump();
    await tester.pump();

    expect(find.text('ETK-ABCDEFGH12345678'), findsOneWidget);
    expect(find.text('Bến Tuần Châu'), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.text('Lưu vé vào máy'), findsOneWidget);
    expect(find.text('Hủy đơn đặt chỗ'), findsOneWidget);
  });

  testWidgets('cancelled e-ticket is visibly disabled and cannot be cancelled again (AC5)', (tester) async {
    _tall(tester);
    await tester.pumpWidget(MaterialApp(
      home: ETicketScreen(booking: _booking(status: BookingStatus.cancelled), repository: _BookingRepo(ticketStatus: ETicketStatus.cancelled)),
    ));
    await tester.pump();
    await tester.pump();

    expect(find.text('ĐÃ VÔ HIỆU HÓA'), findsOneWidget);
    expect(find.text('Hủy đơn đặt chỗ'), findsNothing);
  });

  testWidgets('cancel screen previews a full refund and takes a reason (AC4)', (tester) async {
    _tall(tester);
    await tester.pumpWidget(MaterialApp(home: CancelBookingScreen(booking: _booking(), repository: _BookingRepo())));
    await tester.pump();
    await tester.pump();

    expect(find.byKey(const Key('refund-message')), findsOneWidget);
    expect(find.textContaining('hoàn 100%'), findsOneWidget);
    expect(find.text('Xác nhận hủy'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Thay đổi kế hoạch');
    expect(find.text('Thay đổi kế hoạch'), findsOneWidget);
  });

  testWidgets('cancel screen blocks cancellation inside the window (AC4)', (tester) async {
    _tall(tester);
    await tester.pumpWidget(MaterialApp(
      home: CancelBookingScreen(booking: _booking(departIn: const Duration(hours: 5)), repository: _BookingRepo()),
    ));
    await tester.pump();
    await tester.pump();

    expect(find.textContaining('Đã quá hạn hủy'), findsOneWidget);
    expect(find.text('Xác nhận hủy'), findsNothing);
  });
}
