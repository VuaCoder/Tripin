import 'dart:async';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../chat/bloc/chat_socket.dart';
import '../models/notification_models.dart';
import 'notifications_repository.dart';

class NotificationsState extends Equatable {
  final List<AppNotification> items;
  final int unread;
  final bool loading;
  final String? error;

  /// Thông báo vừa đến qua socket, để màn hình hiện banner (AC5).
  final AppNotification? latest;

  const NotificationsState({this.items = const [], this.unread = 0, this.loading = true, this.error, this.latest});

  NotificationsState copyWith({
    List<AppNotification>? items,
    int? unread,
    bool? loading,
    String? error,
    bool clearError = false,
    AppNotification? latest,
  }) =>
      NotificationsState(
        items: items ?? this.items,
        unread: unread ?? this.unread,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
        latest: latest ?? this.latest,
      );

  @override
  List<Object?> get props => [items, unread, loading, error, latest];
}

/// Danh sách thông báo trong ứng dụng; thông báo mới (tin nhắn, cập nhật đơn đặt) hiện ngay qua socket.
class NotificationsCubit extends Cubit<NotificationsState> {
  final NotificationsRepository _repo;
  final ChatSocket _socket;
  StreamSubscription<Map<String, dynamic>>? _sub;
  StreamSubscription<bool>? _connSub;

  NotificationsCubit({required NotificationsRepository repository, required this._socket})
      : _repo = repository,
        super(const NotificationsState());

  Future<void> start() async {
    _sub = _socket.notifications.listen(_onLive);
    // Sau khi kết nối lại, lấy các thông báo đã lỡ.
    _connSub = _socket.connection.where((c) => c).listen((_) => load(silent: true));
    await _socket.connect();
    await load();
  }

  Future<void> load({bool silent = false}) async {
    if (!silent) emit(state.copyWith(loading: true, clearError: true));
    try {
      final items = await _repo.list();
      final unread = await _repo.unreadCount();
      if (!isClosed) emit(state.copyWith(items: items, unread: unread, loading: false, clearError: true));
    } on NotificationException catch (e) {
      if (!isClosed && !silent) emit(state.copyWith(loading: false, error: e.message));
    }
  }

  void _onLive(Map<String, dynamic> json) {
    if (isClosed) return;
    final n = AppNotification.fromJson(json);
    if (state.items.any((x) => x.id == n.id)) return;
    emit(state.copyWith(items: [n, ...state.items], unread: state.unread + 1, latest: n));
  }

  Future<void> markRead(AppNotification n) async {
    if (n.isRead) return;
    emit(state.copyWith(
      items: [for (final x in state.items) x.id == n.id ? x.asRead() : x],
      unread: state.unread > 0 ? state.unread - 1 : 0,
    ));
    try {
      await _repo.markRead(n.id);
    } on NotificationException {
      // Lần tải sau sẽ đồng bộ lại trạng thái.
    }
  }

  Future<void> markAllRead() async {
    emit(state.copyWith(items: [for (final x in state.items) x.asRead()], unread: 0));
    try {
      await _repo.markAllRead();
    } on NotificationException {
      await load(silent: true);
    }
  }

  @override
  Future<void> close() {
    _sub?.cancel();
    _connSub?.cancel();
    return super.close();
  }
}
