import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/ai_models.dart';
import 'ai_repository.dart';

class AiState extends Equatable {
  /// Theo thứ tự thời gian (cũ → mới).
  final List<AiMessage> messages;

  /// Bot đang soạn câu trả lời → hiện hiệu ứng gõ chữ.
  final bool typing;

  /// Lỗi của lần hỏi gần nhất; câu hỏi đó được giữ lại để "Thử lại".
  final String? error;

  const AiState({this.messages = const [], this.typing = false, this.error});

  @override
  List<Object?> get props => [messages, typing, error];
}

class AiCubit extends Cubit<AiState> {
  final AiRepository _repo;
  String? _conversationId;
  String? _failedQuestion;

  AiCubit({AiRepository? repository})
      : _repo = repository ?? AiRepository(),
        super(const AiState());

  Future<void> ask(String raw) async {
    final text = raw.trim();
    if (text.isEmpty || state.typing) return;
    _failedQuestion = null;
    emit(AiState(
      messages: [...state.messages, AiMessage(role: AiRole.user, content: text, createdAt: DateTime.now())],
      typing: true,
    ));
    await _send(text);
  }

  /// Gửi lại câu hỏi vừa lỗi mà không nhân đôi tin của người dùng.
  Future<void> retry() async {
    final text = _failedQuestion;
    if (text == null || state.typing) return;
    _failedQuestion = null;
    emit(AiState(messages: state.messages, typing: true));
    await _send(text);
  }

  Future<void> _send(String text) async {
    try {
      final reply = await _repo.chat(text, conversationId: _conversationId);
      if (isClosed) return;
      _conversationId = reply.conversationId;
      emit(AiState(messages: [...state.messages, reply.reply]));
    } on AiException catch (e) {
      if (isClosed) return;
      _failedQuestion = text;
      emit(AiState(messages: state.messages, error: e.message));
    }
  }
}
