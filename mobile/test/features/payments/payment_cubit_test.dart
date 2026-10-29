import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/payments/bloc/payment_cubit.dart';
import 'package:mobile/features/payments/bloc/payments_repository.dart';
import 'package:mobile/features/payments/models/payment_models.dart';

class _FakeRepo extends PaymentsRepository {
  PaymentStatus status = PaymentStatus.pending;
  final DateTime expiresAt;
  int polls = 0;
  Duration latency = Duration.zero;

  _FakeRepo(this.expiresAt);

  @override
  Future<CheckoutInfo> createCheckout(String bookingId) async => CheckoutInfo(
        paymentId: 'p1',
        checkoutUrl: 'https://pay.example/p1',
        amount: 500000,
        expiresAt: expiresAt,
        bankTransfer: const BankTransferInfo(
          qrCode: '000201',
          accountNumber: '123',
          accountName: 'TRIPRI',
          bin: '970422',
          description: 'TRP123',
        ),
      );

  @override
  Future<PaymentSnapshot> getPayment(String paymentId) async {
    polls++;
    await Future<void>.delayed(latency);
    return PaymentSnapshot(id: paymentId, status: status, expiresAt: expiresAt);
  }
}

void main() {
  const poll = Duration(milliseconds: 20);

  test('emits PaymentPaid once the backend reports PAID (AC4)', () async {
    final repo = _FakeRepo(DateTime.now().add(const Duration(minutes: 15)));
    final cubit = PaymentCubit(bookingId: 'b1', repository: repo, pollInterval: poll);
    await cubit.start();
    expect(cubit.state, isA<PaymentAwaiting>());

    repo.status = PaymentStatus.paid;
    await expectLater(cubit.stream, emitsThrough(const PaymentPaid('b1')));
    await cubit.close();
  });

  test('manual check reports "not paid yet" while still pending', () async {
    final repo = _FakeRepo(DateTime.now().add(const Duration(minutes: 15)));
    final cubit = PaymentCubit(bookingId: 'b1', repository: repo, pollInterval: const Duration(minutes: 1));
    await cubit.start();
    await cubit.check(manual: true);
    expect((cubit.state as PaymentAwaiting).notPaidYet, isTrue);
    await cubit.close();
  });

  test('expires after the deadline with a final server check (AC5)', () async {
    final repo = _FakeRepo(DateTime.now().add(const Duration(milliseconds: 1200)));
    final cubit = PaymentCubit(bookingId: 'b1', repository: repo, pollInterval: const Duration(minutes: 1));
    await cubit.start();
    await expectLater(cubit.stream, emitsThrough(const PaymentExpired()));
    expect(repo.polls, 1);
    await cubit.close();
  });

  test('a payment settled in the last second still wins over expiry', () async {
    final repo = _FakeRepo(DateTime.now().add(const Duration(milliseconds: 1200)))..status = PaymentStatus.paid;
    final cubit = PaymentCubit(bookingId: 'b1', repository: repo, pollInterval: const Duration(minutes: 1));
    await cubit.start();
    await expectLater(cubit.stream, emitsThrough(const PaymentPaid('b1')));
    await cubit.close();
  });

  test('"Tôi đã chuyển khoản" pressed during an in-flight poll still gets feedback', () async {
    final repo = _FakeRepo(DateTime.now().add(const Duration(minutes: 15)))..latency = const Duration(milliseconds: 150);
    final cubit = PaymentCubit(bookingId: 'b1', repository: repo, pollInterval: const Duration(minutes: 1));
    await cubit.start();
    final poll = cubit.check(); // automatic poll in flight
    await cubit.check(manual: true); // user taps while it runs
    await poll;
    expect((cubit.state as PaymentAwaiting).notPaidYet, isTrue);
    expect((cubit.state as PaymentAwaiting).checking, isFalse);
    await cubit.close();
  });
}
