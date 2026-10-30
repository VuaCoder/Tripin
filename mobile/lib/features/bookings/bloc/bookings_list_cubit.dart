import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/booking_models.dart';
import 'bookings_repository.dart';

class BookingsListState extends Equatable {
  final List<BookingItem> items;
  final int page;
  final bool hasMore;
  final bool loading;
  final bool loadingMore;
  final String? error;

  const BookingsListState({
    this.items = const [],
    this.page = 0,
    this.hasMore = true,
    this.loading = true,
    this.loadingMore = false,
    this.error,
  });

  @override
  List<Object?> get props => [items, page, hasMore, loading, loadingMore, error];
}

/// Danh sách đơn của một tab trạng thái, tải theo trang từ `GET /bookings/me?status=…`.
class BookingsListCubit extends Cubit<BookingsListState> {
  static const pageSize = 10;

  final BookingsRepository _repo;
  final BookingStatus status;

  BookingsListCubit({required this.status, BookingsRepository? repository})
      : _repo = repository ?? BookingsRepository(),
        super(const BookingsListState());

  Future<void> refresh() async {
    emit(const BookingsListState());
    try {
      final result = await _repo.listMine(status: status, page: 1, limit: pageSize);
      if (isClosed) return;
      emit(BookingsListState(items: result.items, page: result.page, hasMore: result.hasMore, loading: false));
    } on BookingException catch (e) {
      if (!isClosed) emit(BookingsListState(loading: false, hasMore: false, error: e.message));
    }
  }

  Future<void> loadMore() async {
    final s = state;
    if (s.loading || s.loadingMore || !s.hasMore || s.error != null) return;
    emit(BookingsListState(items: s.items, page: s.page, hasMore: s.hasMore, loading: false, loadingMore: true));
    try {
      final result = await _repo.listMine(status: status, page: s.page + 1, limit: pageSize);
      if (isClosed) return;
      emit(BookingsListState(
        items: [...s.items, ...result.items],
        page: result.page,
        hasMore: result.hasMore,
        loading: false,
      ));
    } on BookingException catch (e) {
      // Giữ nguyên dữ liệu đã có; chỉ ngừng tải thêm và báo lỗi nhẹ.
      if (!isClosed) {
        emit(BookingsListState(items: s.items, page: s.page, hasMore: s.hasMore, loading: false, error: e.message));
      }
    }
  }
}
