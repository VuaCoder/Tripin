import 'dart:async';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/payment_models.dart';
import 'payments_repository.dart';

sealed class PaymentState extends Equatable {
  const PaymentState();
  @override
  List<Object?> get props => [];
}

class PaymentLoading extends PaymentState {
  const PaymentLoading();
}

class PaymentFailure extends PaymentState {
  final String message;
  const PaymentFailure(this.message);
  @override
  List<Object?> get props => [message];
}

/// Đang chờ khách chuyển khoản; `remaining` giảm mỗi giây.
class PaymentAwaiting extends PaymentState {
  final CheckoutInfo checkout;
  final Duration remaining;
  final bool checking;
  final bool notPaidYet;

  const PaymentAwaiting(this.checkout, this.remaining, {this.checking = false, this.notPaidYet = false});

  PaymentAwaiting copyWith({Duration? remaining, bool? checking, bool? notPaidYet}) => PaymentAwaiting(
        checkout,
        remaining ?? this.remaining,
        checking: checking ?? this.checking,
        notPaidYet: notPaidYet ?? this.notPaidYet,
      );

  @override
  List<Object?> get props => [checkout, remaining, checking, notPaidYet];
}

class PaymentPaid extends PaymentState {
  final String bookingId;
  const PaymentPaid(this.bookingId);
  @override
  List<Object?> get props => [bookingId];
}

/// Quá hạn 15 phút (hoặc bị huỷ/thất bại): cần tạo đơn mới.
class PaymentExpired extends PaymentState {
  const PaymentExpired();
}

class PaymentCubit extends Cubit<PaymentState> {
  final PaymentsRepository _repo;
  final String bookingId;
  final Duration pollInterval;
  final DateTime Function() _now;

  Timer? _ticker;
  Timer? _poller;
  bool _polling = false;

  /// Người dùng bấm "Tôi đã chuyển khoản" lúc một lượt poll đang chạy: báo kết quả khi lượt đó xong.
  bool _manualQueued = false;

  PaymentCubit({
    required this.bookingId,
    PaymentsRepository? repository,
    this.pollInterval = const Duration(seconds: 3),
    DateTime Function()? now,
  })  : _repo = repository ?? PaymentsRepository(),
        _now = now ?? DateTime.now,
        super(const PaymentLoading());

  Future<void> start() async {
    _stopTimers();
    emit(const PaymentLoading());
    try {
      final checkout = await _repo.createCheckout(bookingId);
      if (isClosed) return;
      emit(PaymentAwaiting(checkout, _remaining(checkout)));
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
      _poller = Timer.periodic(pollInterval, (_) => check());
    } on PaymentException catch (e) {
      if (!isClosed) emit(PaymentFailure(e.message));
    }
  }

  Duration _remaining(CheckoutInfo c) {
    final left = c.expiresAt.difference(_now());
    return left.isNegative ? Duration.zero : left;
  }

  void _tick() {
    final s = state;
    if (s is! PaymentAwaiting) return;
    final left = _remaining(s.checkout);
    if (left == Duration.zero) {
      // Hết giờ: hỏi server lần cuối để không bỏ sót giao dịch vừa thanh toán.
      check(finalCheck: true);
    } else {
      emit(s.copyWith(remaining: left));
    }
  }

  /// Poll tự động, hoặc nút "Tôi đã chuyển khoản" (`manual: true`).
  Future<void> check({bool manual = false, bool finalCheck = false}) async {
    final s = state;
    if (s is! PaymentAwaiting) return;
    if (_polling) {
      if (manual) {
        _manualQueued = true;
        emit(s.copyWith(checking: true, notPaidYet: false));
      }
      return;
    }
    _polling = true;
    if (manual) emit(s.copyWith(checking: true, notPaidYet: false));
    try {
      final snap = await _repo.getPayment(s.checkout.paymentId);
      if (isClosed) return;
      if (snap.status == PaymentStatus.paid) {
        _stopTimers();
        emit(PaymentPaid(bookingId));
      } else if (snap.status.isFinalFailure || finalCheck) {
        _stopTimers();
        emit(const PaymentExpired());
      } else if ((manual || _manualQueued) && state is PaymentAwaiting) {
        emit((state as PaymentAwaiting).copyWith(checking: false, notPaidYet: true));
      }
    } on PaymentException {
      // Lỗi mạng thoáng qua: giữ nguyên màn hình, lần poll sau sẽ thử lại.
      if (!isClosed && state is PaymentAwaiting) {
        if (finalCheck) {
          _stopTimers();
          emit(const PaymentExpired());
        } else if (manual || _manualQueued) {
          emit((state as PaymentAwaiting).copyWith(checking: false));
        }
      }
    } finally {
      _polling = false;
      _manualQueued = false;
    }
  }

  void _stopTimers() {
    _ticker?.cancel();
    _poller?.cancel();
    _ticker = _poller = null;
  }

  @override
  Future<void> close() {
    _stopTimers();
    return super.close();
  }
}
