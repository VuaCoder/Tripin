import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/booking_models.dart';
import 'bookings_repository.dart';

sealed class ETicketState extends Equatable {
  const ETicketState();
  @override
  List<Object?> get props => [];
}

class ETicketLoading extends ETicketState {
  const ETicketLoading();
}

class ETicketFailure extends ETicketState {
  final String message;
  const ETicketFailure(this.message);
  @override
  List<Object?> get props => [message];
}

class ETicketLoaded extends ETicketState {
  final ETicket ticket;

  /// true khi đang hiển thị bản cache offline (không gọi được server).
  final bool fromCache;
  const ETicketLoaded(this.ticket, {this.fromCache = false});
  @override
  List<Object?> get props => [ticket, fromCache];
}

class ETicketCubit extends Cubit<ETicketState> {
  final BookingsRepository _repo;
  final String bookingId;

  ETicketCubit({required this.bookingId, BookingsRepository? repository})
      : _repo = repository ?? BookingsRepository(),
        super(const ETicketLoading());

  Future<void> load() async {
    emit(const ETicketLoading());
    try {
      final result = await _repo.getTicketForBooking(bookingId);
      if (!isClosed) emit(ETicketLoaded(result.ticket, fromCache: result.fromCache));
    } on BookingException catch (e) {
      if (!isClosed) emit(ETicketFailure(e.message));
    }
  }
}
