import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../bloc/chat_cubit.dart';
import '../bloc/chat_repository.dart';
import '../bloc/chat_socket.dart';
import '../models/chat_models.dart';

final DateFormat _hm = DateFormat('HH:mm');

/// Màn hình trò chuyện 1-1 giữa khách và HDV.
class ChatScreen extends StatelessWidget {
  final String conversationId;
  final String title;
  final ChatRepository? repository;
  final ChatSocket? socket;

  const ChatScreen({super.key, required this.conversationId, required this.title, this.repository, this.socket});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => ChatCubit(
        conversationId: conversationId,
        repository: repository ?? ChatRepository(),
        socket: socket ?? ChatSocketHub.instance,
      )..start(),
      child: _ChatView(title: title),
    );
  }
}

class _ChatView extends StatefulWidget {
  final String title;
  const _ChatView({required this.title});

  @override
  State<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<_ChatView> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      // Danh sách đảo ngược: cuộn tới cuối = tin cũ nhất.
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 120) {
        context.read<ChatCubit>().loadMore();
      }
    });
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _input.text;
    if (text.trim().isEmpty) return;
    _input.clear();
    context.read<ChatCubit>().send(text);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: BlocBuilder<ChatCubit, ChatState>(
          buildWhen: (a, b) => a.peerTyping != b.peerTyping,
          builder: (context, state) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
              if (state.peerTyping)
                const Text('Đang soạn tin…',
                    key: Key('peer-typing'), style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          BlocBuilder<ChatCubit, ChatState>(
            buildWhen: (a, b) => a.connected != b.connected,
            builder: (context, state) => state.connected
                ? const SizedBox.shrink()
                : Container(
                    key: const Key('reconnecting'),
                    width: double.infinity,
                    color: AppColors.secondaryLight,
                    padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
                    child: const Row(
                      children: [
                        SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2)),
                        SizedBox(width: 8),
                        Expanded(child: Text('Mất kết nối. Đang kết nối lại…', style: TextStyle(fontSize: 12))),
                      ],
                    ),
                  ),
          ),
          Expanded(
            child: BlocBuilder<ChatCubit, ChatState>(
              builder: (context, state) {
                if (state.loading) return const Center(child: CircularProgressIndicator());
                if (state.messages.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        state.error ?? 'Hãy gửi tin nhắn đầu tiên để bắt đầu trò chuyện.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.textSecondary),
                      ),
                    ),
                  );
                }
                return ListView.builder(
                  controller: _scroll,
                  reverse: true,
                  padding: const EdgeInsets.all(12),
                  itemCount: state.messages.length + (state.loadingMore ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i >= state.messages.length) {
                      return const Padding(
                        padding: EdgeInsets.all(8),
                        child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))),
                      );
                    }
                    final m = state.messages[i];
                    return _Bubble(
                      message: m,
                      onRetry: m.status == MessageStatus.failed ? () => context.read<ChatCubit>().retry(m.id) : null,
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 2000,
                      textInputAction: TextInputAction.send,
                      onChanged: (_) => context.read<ChatCubit>().onTyping(),
                      onSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        hintText: 'Nhập tin nhắn…',
                        counterText: '',
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton.filled(
                    tooltip: 'Gửi',
                    onPressed: _submit,
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _statusLabel(MessageStatus s) => switch (s) {
      MessageStatus.sending => 'Đang gửi…',
      MessageStatus.sent => 'Đã gửi',
      MessageStatus.delivered => 'Đã nhận',
      MessageStatus.read => 'Đã đọc',
      MessageStatus.failed => 'Gửi lỗi · Chạm để thử lại',
    };

class _Bubble extends StatelessWidget {
  final ChatMessage message;
  final VoidCallback? onRetry;
  const _Bubble({required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    final mine = message.isMine;
    final failed = message.status == MessageStatus.failed;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onTap: onRetry,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 3),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
          decoration: BoxDecoration(
            color: mine ? AppColors.primary : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: mine ? null : Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(message.text, style: TextStyle(color: mine ? Colors.white : AppColors.textPrimary, height: 1.3)),
              ),
              const SizedBox(height: 2),
              Text(
                mine ? '${_hm.format(message.createdAt)} · ${_statusLabel(message.status)}' : _hm.format(message.createdAt),
                style: TextStyle(
                  fontSize: 11,
                  color: failed ? Colors.redAccent.shade100 : (mine ? Colors.white70 : AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
