import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../core/constants/api_endpoints.dart';
import '../../../core/storage/token_storage.dart';
import '../models/chat_models.dart';

/// Giao diện tối thiểu của kênh realtime `/socket.io` để cubit dễ test.
abstract class ChatSocket {
  /// true khi đang kết nối; phát lại mỗi lần đổi (mất mạng / kết nối lại).
  Stream<bool> get connection;
  bool get isConnected;

  Stream<ChatMessage> get messages;

  /// Người đối diện đang gõ trong cuộc trò chuyện (conversationId).
  Stream<String> get typing;

  /// Tin của mình đã tới máy người nhận.
  Stream<({String conversationId, String messageId})> get delivered;

  /// Thông báo mới (`notification:new`) dạng JSON thô.
  Stream<Map<String, dynamic>> get notifications;

  Future<void> connect();

  /// Gửi qua socket; trả tin đã lưu hoặc ném lỗi để cubit chuyển sang REST.
  Future<ChatMessage> send(String conversationId, String text);

  void sendTyping(String conversationId);
  void sendRead(String conversationId);
  void dispose();
}

/// Sự kiện có ack được thư viện trao dưới dạng `[payload, ack]`; sự kiện thường trao thẳng payload.
({Object? payload, void Function(dynamic)? ack}) unpackEvent(dynamic data) {
  if (data is List && data.isNotEmpty) {
    final last = data.last;
    final ack = (data.length > 1 && last is Function) ? (last as dynamic Function(dynamic)) : null;
    return (payload: data.first, ack: ack == null ? null : (v) => ack(v));
  }
  return (payload: data, ack: null);
}

/// Cài đặt thật bằng `socket_io_client`, tự kết nối lại khi mất mạng (AC1).
class SocketIoChatSocket implements ChatSocket {
  final TokenStorage _tokens;
  io.Socket? _socket;

  final _connection = StreamController<bool>.broadcast();
  final _messages = StreamController<ChatMessage>.broadcast();
  final _typing = StreamController<String>.broadcast();
  final _delivered = StreamController<({String conversationId, String messageId})>.broadcast();
  final _notifications = StreamController<Map<String, dynamic>>.broadcast();

  SocketIoChatSocket({TokenStorage? tokens}) : _tokens = tokens ?? TokenStorage();

  @override
  Stream<bool> get connection => _connection.stream;
  @override
  bool get isConnected => _socket?.connected ?? false;
  @override
  Stream<ChatMessage> get messages => _messages.stream;
  @override
  Stream<String> get typing => _typing.stream;
  @override
  Stream<({String conversationId, String messageId})> get delivered => _delivered.stream;
  @override
  Stream<Map<String, dynamic>> get notifications => _notifications.stream;

  @override
  Future<void> connect() async {
    if (_socket != null) return;
    final token = await _tokens.getAccessToken();
    final socket = io.io(
      ApiEndpoints.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(10000)
          .enableAutoConnect()
          .build(),
    );
    _socket = socket;

    socket.onConnect((_) => _connection.add(true));
    socket.onDisconnect((_) => _connection.add(false));
    socket.onConnectError((_) => _connection.add(false));
    // Đọc lại token ở mỗi lần thử kết nối lại để dùng bản mới nhất sau khi làm mới phiên.
    socket.io.on('reconnect_attempt', (_) async {
      socket.auth = {'token': await _tokens.getAccessToken()};
    });

    socket.on('chat:message', (data) {
      final event = unpackEvent(data);
      final map = event.payload as Map;
      _messages.add(ChatMessage.fromJson(Map<String, dynamic>.from(map['message'] as Map)));
      // Ack `true` để backend báo "đã nhận" cho người gửi.
      event.ack?.call(true);
    });
    socket.on('chat:typing', (data) => _typing.add((unpackEvent(data).payload as Map)['conversationId'] as String));
    socket.on('chat:delivered', (data) {
      final map = unpackEvent(data).payload as Map;
      _delivered.add((conversationId: map['conversationId'] as String, messageId: map['messageId'] as String));
    });
    socket.on('notification:new', (data) => _notifications.add(Map<String, dynamic>.from(unpackEvent(data).payload as Map)));
  }

  @override
  Future<ChatMessage> send(String conversationId, String text) {
    final socket = _socket;
    if (socket == null || !socket.connected) {
      return Future.error(StateError('socket offline'));
    }
    final completer = Completer<ChatMessage>();
    socket.emitWithAck('chat:send', {'conversationId': conversationId, 'text': text}, ack: (dynamic res) {
      if (res is Map && res['ok'] == true) {
        completer.complete(ChatMessage.fromJson(Map<String, dynamic>.from(res['data'] as Map)));
      } else {
        completer.completeError(StateError('send rejected'));
      }
    });
    return completer.future.timeout(const Duration(seconds: 8));
  }

  @override
  void sendTyping(String conversationId) => _socket?.emit('chat:typing', {'conversationId': conversationId});

  @override
  void sendRead(String conversationId) => _socket?.emit('chat:read', {'conversationId': conversationId});

  @override
  void dispose() {
    _socket?.dispose();
    _socket = null;
    _connection.close();
    _messages.close();
    _typing.close();
    _delivered.close();
    _notifications.close();
  }
}

/// Một kết nối Socket.IO dùng chung cho chat và thông báo trong cả ứng dụng.
class ChatSocketHub {
  ChatSocketHub._();
  static ChatSocket? _instance;
  static ChatSocket get instance => _instance ??= SocketIoChatSocket();
}
