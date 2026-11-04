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
  final DateTime Function() _now;

  Timer? _ticker;
  Timer? _poller;
  bool _polling = false;
  bool _isPollingPaused = false;
  DateTime? _startedAt;

  /// Người dùng bấm "Tôi đã chuyển khoản" lúc một lượt poll đang chạy: báo kết quả khi lượt đó xong.
  bool _manualQueued = false;

  PaymentCubit({
    required this.bookingId,
    PaymentsRepository? repository,
    Duration? pollInterval, // giữ tương thích tham số cũ
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
      _startedAt = _now();
      _isPollingPaused = false;
      emit(PaymentAwaiting(checkout, _remaining(checkout)));
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
      _scheduleNextPoll();
    } on PaymentException catch (e) {
      if (!isClosed) emit(PaymentFailure(e.message));
    }
  }

  /// Tạm dừng Polling khi người dùng ẩn app Tripri để mở app ngân hàng
  void pausePolling() {
    _isPollingPaused = true;
    _poller?.cancel();
    _poller = null;
  }

  /// Tiếp tục Polling và kiểm tra ngay lập tức khi người dùng quay lại app Tripri
  void resumePollingAndCheck() {
    if (isClosed || state is! PaymentAwaiting) return;
    _isPollingPaused = false;
    check();
  }

  /// Tính toán thời gian giãn cách thích ứng (Adaptive Interval):
  /// - 0 - 15 giây đầu: 5s/lần (người dùng đang thao tác mở ngân hàng)
  /// - 15 - 60 giây: 3s/lần (thời điểm vàng khách vừa chuyển tiền xong)
  /// - Sau 60 giây: 8s/lần (giảm tải triệt để cho server)
  Duration _getAdaptiveInterval() {
    if (_startedAt == null) return const Duration(seconds: 4);
    final elapsedSec = _now().difference(_startedAt!).inSeconds;
    if (elapsedSec < 15) {
      return const Duration(seconds: 5);
    } else if (elapsedSec < 60) {
      return const Duration(seconds: 3);
    } else {
      return const Duration(seconds: 8);
    }
  }

  void _scheduleNextPoll() {
    _poller?.cancel();
    if (_isPollingPaused || isClosed || state is! PaymentAwaiting) return;

    final interval = _getAdaptiveInterval();
    _poller = Timer(interval, () {
      check();
    });
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
      check(finalCheck: true);
    } else {
      emit(s.copyWith(remaining: left));
    }
  }

  /// Poll kiểm tra trạng thái thanh toán
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
      if (!isClosed && state is PaymentAwaiting && !_isPollingPaused) {
        _scheduleNextPoll();
      }
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
