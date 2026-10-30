import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/chat_repository.dart';
import '../bloc/chat_socket.dart';
import '../models/chat_models.dart';
import 'chat_screen.dart';

final DateFormat _hm = DateFormat('HH:mm');
final DateFormat _dm = DateFormat('dd/MM');

String _when(DateTime? t) {
  if (t == null) return '';
  final now = DateTime.now();
  final sameDay = t.year == now.year && t.month == now.month && t.day == now.day;
  return sameDay ? _hm.format(t) : _dm.format(t);
}

/// Hộp thư: danh sách cuộc trò chuyện, cập nhật ngay khi có tin mới.
class ConversationsScreen extends StatefulWidget {
  final ChatRepository? repository;
  final ChatSocket? socket;

  const ConversationsScreen({super.key, this.repository, this.socket});

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  late final ChatRepository _repo = widget.repository ?? ChatRepository();
  late final ChatSocket _socket = widget.socket ?? ChatSocketHub.instance;
  StreamSubscription<ChatMessage>? _sub;
  List<Conversation>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _socket.connect();
    _sub = _socket.messages.listen((_) => _load());
    _load();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await _repo.listConversations();
      if (!mounted) return;
      setState(() {
        _items = items;
        _error = null;
      });
    } on ChatException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _open(Conversation c) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ChatScreen(
        conversationId: c.id,
        title: c.counterpart?.fullName ?? 'Trò chuyện',
        repository: widget.repository,
        socket: widget.socket,
      ),
    ));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: const Text('Tin nhắn', style: TextStyle(fontWeight: FontWeight.bold))),
      body: RefreshIndicator(
        onRefresh: _load,
        child: items == null
            ? (_error == null
                ? const Center(child: CircularProgressIndicator())
                : _Message(text: _error!, onRetry: _load))
            : items.isEmpty
                ? const _Message(text: 'Chưa có cuộc trò chuyện nào. Bạn có thể nhắn tin cho hướng dẫn viên từ vé điện tử của tour đã đặt.')
                : ListView.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final c = items[i];
                      final name = c.counterpart?.fullName ?? 'Người dùng';
                      final unread = c.unreadCount > 0;
                      return ListTile(
                        onTap: () => _open(c),
                        leading: CircleAvatar(
                          backgroundColor: AppColors.secondaryLight,
                          child: Text(name.isEmpty ? '?' : name.characters.first.toUpperCase()),
                        ),
                        title: Text(name, style: TextStyle(fontWeight: unread ? FontWeight.bold : FontWeight.w500)),
                        subtitle: Text(
                          c.lastText ?? 'Chưa có tin nhắn',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontWeight: unread ? FontWeight.w600 : FontWeight.normal),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(_when(c.lastSentAt ?? c.updatedAt), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            if (unread)
                              Container(
                                key: Key('unread-${c.id}'),
                                margin: const EdgeInsets.only(top: 4),
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                                child: Text('${c.unreadCount}', style: const TextStyle(color: Colors.white, fontSize: 12)),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  final String text;
  final VoidCallback? onRetry;
  const _Message({required this.text, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 120),
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Text(text, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                OutlinedButton(onPressed: onRetry, child: const Text('Thử lại')),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
