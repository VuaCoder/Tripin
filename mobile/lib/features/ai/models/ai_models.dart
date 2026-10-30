import 'package:equatable/equatable.dart';

enum AiRole { user, assistant }

class AiMessage extends Equatable {
  final AiRole role;
  final String content;
  final DateTime createdAt;

  const AiMessage({required this.role, required this.content, required this.createdAt});

  @override
  List<Object?> get props => [role, content, createdAt];
}

/// Kết quả `POST /ai/chat`.
class AiReply extends Equatable {
  final String conversationId;
  final AiMessage reply;

  const AiReply({required this.conversationId, required this.reply});

  factory AiReply.fromJson(Map<String, dynamic> json) {
    final reply = json['reply'] as Map<String, dynamic>;
    return AiReply(
      conversationId: json['conversationId'] as String,
      reply: AiMessage(
        role: AiRole.assistant,
        content: reply['content'] as String? ?? '',
        createdAt: DateTime.tryParse(reply['createdAt'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      ),
    );
  }

  @override
  List<Object?> get props => [conversationId, reply];
}
