import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../models/ai_models.dart';
import '../storage/ai_storage.dart';
import 'ai_repository.dart';

class AiState extends Equatable {
  /// Theo thứ tự thời gian (cũ → mới).
  final List<AiMessage> messages;

  /// Bot đang soạn câu trả lời → hiện hiệu ứng gõ chữ.
  final bool typing;

  /// Lỗi của lần hỏi gần nhất; câu hỏi đó được giữ lại để "Thử lại".
  final String? error;

  const AiState({this.messages = const [], this.typing = false, this.error});

  AiState copyWith({
    List<AiMessage>? messages,
    bool? typing,
    String? error,
    bool clearError = false,
  }) => AiState(
    messages: messages ?? this.messages,
    typing: typing ?? this.typing,
    error: clearError ? null : (error ?? this.error),
  );

  @override
  List<Object?> get props => [messages, typing, error];
}

class AiCubit extends Cubit<AiState> {
  final AiRepository _repo;
  final AiStorage _storage;
  String? _conversationId;
  String? _failedQuestion;
  int _revision = 0;
  String? _readBoundary;

  Future<({List<AiConversationSummary> items, int totalPages})>
  listConversations({int page = 1}) => _repo.listConversations(page: page);

  Future<void> openConversation(String id) async {
    if (state.typing) return;
    final revision = ++_revision;
    try {
      final messages = await _repo.getConversation(id);
      if (isClosed || revision != _revision) return;
      _conversationId = id;
      _failedQuestion = null;
      _readBoundary = null;
      emit(AiState(messages: messages));
      await _storage.saveMessages(messages: messages, conversationId: id);
    } catch (_) {
      if (!isClosed && revision == _revision) {
        emit(
          state.copyWith(
            error: 'Không tải được cuộc trò chuyện. Vui lòng thử lại.',
          ),
        );
      }
    }
  }

  Future<void> markVisibleRead() async {
    final id = _conversationId;
    final replies = state.messages.where(
      (message) => message.role == AiRole.assistant && message.id != null,
    );
    if (id == null || replies.isEmpty) return;
    final boundary = replies.last.id!;
    if (_readBoundary == '$id:$boundary') return;
    try {
      await _repo.markRead(id, boundary);
      if (!isClosed && id == _conversationId) _readBoundary = '$id:$boundary';
    } catch (_) {
      /* Retry when the visible thread reaches the bottom again. */
    }
  }

  AiCubit({AiRepository? repository, AiStorage? storage})
    : _repo = repository ?? AiRepository(),
      _storage = storage ?? AiStorage(),
      super(const AiState()) {
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final revision = _revision;
    try {
      final savedMessages = await _storage.getMessages();
      final savedConvId = await _storage.getConversationId();
      if (isClosed || revision != _revision) return;
      if (_conversationId == null && savedConvId != null) {
        _conversationId = savedConvId;
      }
      if (state.messages.isEmpty && savedMessages.isNotEmpty && !isClosed) {
        emit(state.copyWith(messages: savedMessages));
      }
    } catch (_) {}
  }

  Future<void> clearHistory() async {
    if (state.typing) return;
    _revision += 1;
    _readBoundary = null;
    _conversationId = null;
    _failedQuestion = null;
    await _storage.clear();
    if (!isClosed) {
      emit(const AiState(messages: [], typing: false));
    }
  }

  Future<void> ask(String raw) async {
    final text = raw.trim();
    if (text.isEmpty || state.typing) return;
    _revision += 1;
    _failedQuestion = null;
    final userMsg = AiMessage(
      role: AiRole.user,
      content: text,
      createdAt: DateTime.now(),
      status: AiMessageStatus.sent,
    );
    final updated = [...state.messages, userMsg];
    emit(state.copyWith(messages: updated, typing: true, clearError: true));
    await _storage.saveMessages(
      messages: updated,
      conversationId: _conversationId,
    );
    await _send(text);
  }

  /// Gửi lại câu hỏi vừa lỗi mà không nhân đôi tin của người dùng.
  Future<void> retry() async {
    final text = _failedQuestion;
    if (text == null || state.typing) return;
    _failedQuestion = null;
    emit(state.copyWith(typing: true, clearError: true));
    await _send(text);
  }

  Future<void> _send(String text) async {
    try {
      final reply = await _repo.chat(text, conversationId: _conversationId);
      if (isClosed) return;
      _conversationId = reply.conversationId;

      final updatedMessages = state.messages.map((m) {
        if (m.role == AiRole.user && m.status != AiMessageStatus.read) {
          return m.copyWith(status: AiMessageStatus.read);
        }
        return m;
      }).toList()..add(reply.reply);

      emit(state.copyWith(messages: updatedMessages, typing: false));
      await _storage.saveMessages(
        messages: updatedMessages,
        conversationId: _conversationId,
      );
    } on AiException catch (e) {
      if (isClosed) return;
      _failedQuestion = text;
      final updatedMessages = state.messages.map((m) {
        if (m.role == AiRole.user && m == state.messages.last) {
          return m.copyWith(status: AiMessageStatus.failed);
        }
        return m;
      }).toList();
      emit(
        state.copyWith(
          messages: updatedMessages,
          typing: false,
          error: e.message,
        ),
      );
    }
  }
}
