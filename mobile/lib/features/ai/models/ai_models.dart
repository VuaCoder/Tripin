import 'package:equatable/equatable.dart';

enum AiRole { user, assistant }

enum AiMessageStatus { sending, sent, delivered, read, failed }

class AiMessage extends Equatable {
  final String? id;
  final AiRole role;
  final String content;
  final DateTime createdAt;
  final AiMessageStatus status;
  final bool incomplete;

  const AiMessage({
    this.id,
    required this.role,
    required this.content,
    required this.createdAt,
    this.status = AiMessageStatus.read,
    this.incomplete = false,
  });

  factory AiMessage.fromJson(Map<String, dynamic> json) {
    return AiMessage(
      id: json['id'] as String?,
      role: json['role'] == 'user' ? AiRole.user : AiRole.assistant,
      content: json['content'] as String? ?? '',
      incomplete: json['incomplete'] == true,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ??
          DateTime.now(),
      status: AiMessageStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => AiMessageStatus.read,
      ),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'role': role.name,
    'content': content,
    'createdAt': createdAt.toIso8601String(),
    'status': status.name,
    'incomplete': incomplete,
  };

  AiMessage copyWith({
    AiRole? role,
    String? content,
    DateTime? createdAt,
    AiMessageStatus? status,
    bool? incomplete,
  }) {
    return AiMessage(
      id: id,
      role: role ?? this.role,
      content: content ?? this.content,
      createdAt: createdAt ?? this.createdAt,
      status: status ?? this.status,
      incomplete: incomplete ?? this.incomplete,
    );
  }

  @override
  List<Object?> get props => [id, role, content, createdAt, status, incomplete];
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
        id: reply['id'] as String?,
        incomplete: reply['incomplete'] == true,
        role: AiRole.assistant,
        content: reply['content'] as String? ?? '',
        createdAt:
            DateTime.tryParse(reply['createdAt'] as String? ?? '')?.toLocal() ??
            DateTime.now(),
      ),
    );
  }

  @override
  List<Object?> get props => [conversationId, reply];
}

class AiConversationSummary {
  const AiConversationSummary({
    required this.id,
    required this.title,
    required this.unreadCount,
  });
  final String id;
  final String title;
  final int unreadCount;
  factory AiConversationSummary.fromJson(Map<String, dynamic> json) =>
      AiConversationSummary(
        id: json['id'] as String,
        title: json['title'] as String,
        unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      );
}
