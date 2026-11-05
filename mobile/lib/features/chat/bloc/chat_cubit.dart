import 'dart:async';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/chat_models.dart';
import 'chat_repository.dart';
import 'chat_socket.dart';

class ChatState extends Equatable {
  /// Mới nhất trước (đảo ngược khi hiển thị).
  final List<ChatMessage> messages;
  final bool loading;
  final bool loadingMore;
  final bool hasMore;
  final String? error;
  final bool connected;
  final bool peerTyping;

  const ChatState({
    this.messages = const [],
    this.loading = true,
    this.loadingMore = false,
    this.hasMore = false,
    this.error,
    this.connected = false,
    this.peerTyping = false,
  });

  ChatState copyWith({
    List<ChatMessage>? messages,
    bool? loading,
    bool? loadingMore,
    bool? hasMore,
    String? error,
    bool clearError = false,
    bool? connected,
    bool? peerTyping,
  }) =>
      ChatState(
        messages: messages ?? this.messages,
        loading: loading ?? this.loading,
        loadingMore: loadingMore ?? this.loadingMore,
        hasMore: hasMore ?? this.hasMore,
        error: clearError ? null : (error ?? this.error),
        connected: connected ?? this.connected,
        peerTyping: peerTyping ?? this.peerTyping,
      );

  @override
  List<Object?> get props => [messages, loading, loadingMore, hasMore, error, connected, peerTyping];
}

/// Một cuộc trò chuyện: lịch sử qua REST, tin mới tức thì qua Socket.IO (AC2),
/// tự đồng bộ lại tin bị lỡ khi kết nối lại (AC1).
class ChatCubit extends Cubit<ChatState> {
  final String conversationId;
  final ChatRepository _repo;
  final ChatSocket _socket;
  final Duration typingTimeout;

  final List<StreamSubscription<dynamic>> _subs = [];
  Timer? _typingClear;
  DateTime? _lastTypingSent;
  int _localSeq = 0;

  ChatCubit({
    required this.conversationId,
    required ChatRepository repository,
    required this._socket,
    this.typingTimeout = const Duration(seconds: 3),
  })  : _repo = repository,
        super(const ChatState());

  Future<void> start() async {
    _subs
      ..add(_socket.messages.where((m) => m.conversationId == conversationId).listen(_onIncoming))
      ..add(_socket.typing.where((id) => id == conversationId).listen((_) => _onPeerTyping()))
      ..add(_socket.delivered.where((d) => d.conversationId == conversationId).listen((d) => _markDelivered(d.messageId)))
      ..add(_socket.connection.listen(_onConnection));
    emit(state.copyWith(connected: _socket.isConnected));
    await _socket.connect();
    await _loadLatest(initial: true);
  }

  Future<void> _loadLatest({bool initial = false}) async {
    try {
      final page = await _repo.listMessages(conversationId);
      if (isClosed) return;
      // Giữ lại tin đang gửi / gửi lỗi chưa có trên server.
      final pending = state.messages.where((m) => m.isLocal).toList();
      final merged = [...pending, ...page.items];
      emit(state.copyWith(
        messages: merged,
        loading: false,
        hasMore: initial ? page.hasMore : state.hasMore || page.hasMore,
        clearError: true,
      ));
      _socket.sendRead(conversationId);
      unawaited(_repo.markRead(conversationId).catchError((_) {}));
    } on ChatException catch (e) {
      if (!isClosed) emit(state.copyWith(loading: false, error: e.message));
    }
  }

  Future<void> loadMore() async {
    final s = state;
    if (s.loadingMore || !s.hasMore || s.messages.isEmpty) return;
    final oldest = s.messages.lastWhere((m) => !m.isLocal, orElse: () => s.messages.last);
    emit(s.copyWith(loadingMore: true));
    try {
      final page = await _repo.listMessages(conversationId, before: oldest.id);
      if (isClosed) return;
      emit(state.copyWith(messages: [...state.messages, ...page.items], loadingMore: false, hasMore: page.hasMore));
    } on ChatException catch (e) {
      if (!isClosed) emit(state.copyWith(loadingMore: false, error: e.message));
    }
  }

  void _onConnection(bool connected) {
    if (isClosed) return;
    emit(state.copyWith(connected: connected));
    // Vừa kết nối lại: lấy các tin đã lỡ trong lúc mất mạng.
    if (connected && !state.loading) unawaited(_syncMissed().then((_) => _resendFailed()));
  }

  /// Tin gửi lỗi do mất mạng được gửi lại tự động khi đã kết nối lại.
  Future<void> _resendFailed() async {
    final failed = state.messages.where((m) => m.status == MessageStatus.failed).toList().reversed;
    for (final m in failed) {
      if (isClosed) return;
      await retry(m.id);
    }
  }

  Future<void> _syncMissed() async {
    try {
      final page = await _repo.listMessages(conversationId);
      if (isClosed) return;
      for (final m in page.items.reversed) {
        _insertServerMessage(m);
      }
    } on ChatException {
      // Lần kết nối lại tiếp theo sẽ đồng bộ tiếp.
    }
  }

  void _onIncoming(ChatMessage message) {
    _insertServerMessage(message);
    if (!message.isMine) {
      _socket.sendRead(conversationId);
      if (!isClosed && state.peerTyping) emit(state.copyWith(peerTyping: false));
    }
  }

  /// Thêm tin từ server nếu chưa có; tin của mình đang gửi (local) được thay bằng bản đã lưu.
  void _insertServerMessage(ChatMessage message) {
    if (isClosed) return;
    final list = [...state.messages];
    if (list.any((m) => m.id == message.id)) return;
    if (message.isMine) {
      final i = list.lastIndexWhere((m) => m.isLocal && m.text == message.text && m.status == MessageStatus.sending);
      if (i >= 0) {
        list[i] = message;
        emit(state.copyWith(messages: list));
        return;
      }
    }
    list.insert(0, message);
    emit(state.copyWith(messages: list));
  }

  void _markDelivered(String messageId) {
    if (isClosed) return;
    final list = [
      for (final m in state.messages)
        m.id == messageId && m.status == MessageStatus.sent ? m.copyWith(status: MessageStatus.delivered) : m,
    ];
    emit(state.copyWith(messages: list));
  }

  void _onPeerTyping() {
    if (isClosed) return;
    emit(state.copyWith(peerTyping: true));
    _typingClear?.cancel();
    _typingClear = Timer(typingTimeout, () {
      if (!isClosed) emit(state.copyWith(peerTyping: false));
    });
  }

  /// Gọi khi người dùng gõ; chỉ báo "đang gõ" tối đa 1 lần / 2 giây.
  void onTyping() {
    final now = DateTime.now();
    final last = _lastTypingSent;
    if (last != null && now.difference(last) < const Duration(seconds: 2)) return;
    _lastTypingSent = now;
    _socket.sendTyping(conversationId);
  }

  Future<void> send(String rawText) async {
    final text = rawText.trim();
    if (text.isEmpty) return;
    final local = ChatMessage(
      id: 'local-${++_localSeq}',
      conversationId: conversationId,
      senderId: '',
      text: text,
      isMine: true,
      createdAt: DateTime.now(),
      status: MessageStatus.sending,
    );
    emit(state.copyWith(messages: [local, ...state.messages]));
    await _deliver(local);
  }

  Future<void> retry(String localId) async {
    final i = state.messages.indexWhere((m) => m.id == localId);
    if (i < 0) return;
    final sending = state.messages[i].copyWith(status: MessageStatus.sending);
    final list = [...state.messages]..[i] = sending;
    emit(state.copyWith(messages: list));
    await _deliver(sending);
  }

  /// Socket trước (tức thì); nếu socket không dùng được thì gửi bằng REST để tin không mất.
  Future<void> _deliver(ChatMessage local) async {
    ChatMessage saved;
    try {
      saved = await _socket.send(conversationId, local.text);
    } catch (_) {
      try {
        saved = await _repo.sendMessage(conversationId, local.text);
      } on ChatException {
        _replace(local.id, local.copyWith(status: MessageStatus.failed));
        return;
      }
    }
    if (isClosed) return;
    final list = [...state.messages];
    final already = list.any((m) => m.id == saved.id);
    final i = list.indexWhere((m) => m.id == local.id);
    if (already) {
      if (i >= 0) list.removeAt(i); // bản echo từ socket đã thay thế trước đó
    } else if (i >= 0) {
      list[i] = saved;
    } else {
      list.insert(0, saved);
    }
    emit(state.copyWith(messages: list));
  }

  void _replace(String id, ChatMessage next) {
    if (isClosed) return;
    emit(state.copyWith(messages: [for (final m in state.messages) m.id == id ? next : m]));
  }

  @override
  Future<void> close() {
    _typingClear?.cancel();
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
