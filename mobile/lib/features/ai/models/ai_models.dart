import 'package:equatable/equatable.dart';

enum AiRole { user, assistant }

enum AiMessageStatus { sending, sent, delivered, read, failed }

class AiMessage extends Equatable {
  final AiRole role;
  final String content;
  final DateTime createdAt;
  final AiMessageStatus status;

  const AiMessage({
    required this.role,
    required this.content,
    required this.createdAt,
    this.status = AiMessageStatus.read,
  });

  factory AiMessage.fromJson(Map<String, dynamic> json) {
    return AiMessage(
      role: json['role'] == 'user' ? AiRole.user : AiRole.assistant,
      content: json['content'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      status: AiMessageStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => AiMessageStatus.read,
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        'role': role.name,
        'content': content,
        'createdAt': createdAt.toIso8601String(),
        'status': status.name,
      };

  AiMessage copyWith({
    AiRole? role,
    String? content,
    DateTime? createdAt,
    AiMessageStatus? status,
  }) {
    return AiMessage(
      role: role ?? this.role,
      content: content ?? this.content,
      createdAt: createdAt ?? this.createdAt,
      status: status ?? this.status,
    );
  }

  @override
  List<Object?> get props => [role, content, createdAt, status];
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
