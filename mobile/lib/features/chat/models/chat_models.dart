import 'package:equatable/equatable.dart';

DateTime _time(Object? raw) => DateTime.tryParse(raw as String? ?? '')?.toLocal() ?? DateTime.now();

class Counterpart extends Equatable {
  final String id;
  final String fullName;
  final String? avatarUrl;
  final String role;

  const Counterpart({required this.id, required this.fullName, this.avatarUrl, required this.role});

  factory Counterpart.fromJson(Map<String, dynamic> json) => Counterpart(
        id: json['id'] as String,
        fullName: json['fullName'] as String? ?? '',
        avatarUrl: json['avatarUrl'] as String?,
        role: json['role'] as String? ?? '',
      );

  bool get isGuide => role == 'TOUR_GUIDE';

  @override
  List<Object?> get props => [id, fullName, avatarUrl, role];
}

/// Một dòng của `GET /chat/conversations`.
class Conversation extends Equatable {
  final String id;
  final Counterpart? counterpart;
  final String? lastText;
  final DateTime? lastSentAt;
  final int unreadCount;
  final DateTime updatedAt;

  const Conversation({
    required this.id,
    required this.counterpart,
    required this.lastText,
    required this.lastSentAt,
    required this.unreadCount,
    required this.updatedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    final last = json['lastMessage'] as Map<String, dynamic>?;
    final counterpart = json['counterpart'] as Map<String, dynamic>?;
    return Conversation(
      id: json['id'] as String,
      counterpart: counterpart == null ? null : Counterpart.fromJson(counterpart),
      lastText: last?['text'] as String?,
      lastSentAt: last == null ? null : _time(last['sentAt']),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      updatedAt: _time(json['updatedAt']),
    );
  }

  @override
  List<Object?> get props => [id, counterpart, lastText, lastSentAt, unreadCount, updatedAt];
}

enum MessageStatus { sending, sent, delivered, read, failed }

class ChatMessage extends Equatable {
  /// Id của server; với tin đang gửi là id tạm `local-…`.
  final String id;
  final String conversationId;
  final String senderId;
  final String text;
  final bool isMine;
  final DateTime createdAt;
  final MessageStatus status;

  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.text,
    required this.isMine,
    required this.createdAt,
    required this.status,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final isMine = json['isMine'] as bool? ?? false;
    return ChatMessage(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String? ?? '',
      senderId: json['senderId'] as String? ?? '',
      text: json['text'] as String? ?? '',
      isMine: isMine,
      createdAt: _time(json['createdAt']),
      status: json['readAt'] != null ? MessageStatus.read : MessageStatus.sent,
    );
  }

  ChatMessage copyWith({MessageStatus? status}) => ChatMessage(
        id: id,
        conversationId: conversationId,
        senderId: senderId,
        text: text,
        isMine: isMine,
        createdAt: createdAt,
        status: status ?? this.status,
      );

  bool get isLocal => id.startsWith('local-');

  @override
  List<Object?> get props => [id, conversationId, senderId, text, isMine, createdAt, status];
}

class MessagesPage extends Equatable {
  /// Mới nhất trước (đúng thứ tự backend trả).
  final List<ChatMessage> items;
  final bool hasMore;
  const MessagesPage(this.items, this.hasMore);

  @override
  List<Object?> get props => [items, hasMore];
}
