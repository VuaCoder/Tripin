import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../bloc/ai_cubit.dart';
import '../bloc/ai_repository.dart';
import '../models/ai_models.dart';

const _suggestions = [
  'Gợi ý lịch trình Hạ Long 2 ngày 1 đêm',
  'Thời tiết Đà Nẵng tháng này thế nào?',
  'Nên chuẩn bị hành lý gì cho chuyến đi biển?',
];

/// Tab "Trợ lý AI": hỏi lịch trình, thời tiết, kinh nghiệm chuẩn bị hành lý.
class AiChatScreen extends StatelessWidget {
  final AiRepository? repository;
  const AiChatScreen({super.key, this.repository});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => AiCubit(repository: repository),
      child: const _AiView(),
    );
  }
}

class _AiView extends StatefulWidget {
  const _AiView();

  @override
  State<_AiView> createState() => _AiViewState();
}

class _AiViewState extends State<_AiView> {
  Future<void> _showConversations() async {
    final cubit = context.read<AiCubit>();
    var page = 1;
    var future = cubit.listConversations();
    final chosen = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, update) => AlertDialog(
          title: const Text('Lịch sử hội thoại AI'),
          content: SizedBox(
            width: 440,
            height: 380,
            child: FutureBuilder(
              future: future,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Column(
                    children: [
                      const Text('Không tải được lịch sử.'),
                      TextButton(
                        onPressed: () => update(
                          () => future = cubit.listConversations(page: page),
                        ),
                        child: const Text('Thử lại'),
                      ),
                    ],
                  );
                }
                final data = snapshot.data;
                if (data == null) {
                  return const Center(child: CircularProgressIndicator());
                }
                return Column(
                  children: [
                    Expanded(
                      child: data.items.isEmpty
                          ? const Center(
                              child: Text('Chưa có cuộc trò chuyện.'),
                            )
                          : ListView(
                              children: data.items
                                  .map(
                                    (item) => ListTile(
                                      title: Text(item.title),
                                      trailing: item.unreadCount > 0
                                          ? Badge(
                                              label: Text(
                                                '${item.unreadCount}',
                                              ),
                                            )
                                          : null,
                                      onTap: () =>
                                          Navigator.of(dialogContext)
                                              .pop(item.id),
                                    ),
                                  )
                                  .toList(),
                            ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: page > 1
                              ? () => update(() {
                                  page--;
                                  future = cubit.listConversations(page: page);
                                })
                              : null,
                          child: const Text('Trang trước'),
                        ),
                        TextButton(
                          onPressed: page < data.totalPages
                              ? () => update(() {
                                  page++;
                                  future = cubit.listConversations(page: page);
                                })
                              : null,
                          child: const Text('Trang sau'),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Đóng'),
            ),
          ],
        ),
      ),
    );
    if (chosen != null && mounted) await cubit.openConversation(chosen);
  }

  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _ask(String text) {
    if (text.trim().isEmpty) return;
    _input.clear();
    context.read<AiCubit>().ask(text);
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll
          .animateTo(
            _scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          )
          .then((_) {
            if (mounted) context.read<AiCubit>().markVisibleRead();
          });
    });
  }

  Future<void> _showClearConfirmation(BuildContext context) async {
    final cubit = context.read<AiCubit>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa lịch sử trò chuyện?'),
        content: const Text(
          'Toàn bộ tin nhắn với Trợ lý AI sẽ bị xóa khỏi máy. Bạn có chắc muốn tiếp tục?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await cubit.clearHistory();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Trợ lý AI',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          BlocBuilder<AiCubit, AiState>(
            builder: (context, state) => IconButton(
              tooltip: 'Lịch sử hội thoại AI',
              onPressed: state.typing ? null : _showConversations,
              icon: const Icon(Icons.history),
            ),
          ),
          BlocBuilder<AiCubit, AiState>(
            builder: (context, state) {
              if (state.messages.isEmpty) return const SizedBox.shrink();
              return IconButton(
                icon: const Icon(Icons.delete_outline_rounded),
                tooltip: 'Xóa lịch sử',
                onPressed: () => _showClearConfirmation(context),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: BlocConsumer<AiCubit, AiState>(
              listener: (_, _) => _scrollToEnd(),
              builder: (context, state) {
                if (state.messages.isEmpty && !state.typing) {
                  return _Welcome(onPick: _ask);
                }
                return ListView(
                  controller: _scroll,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  children: [
                    for (int i = 0; i < state.messages.length; i++) ...[
                      if (i == 0 ||
                          !_isSameDay(
                            state.messages[i].createdAt,
                            state.messages[i - 1].createdAt,
                          ))
                        _buildDateChip(state.messages[i].createdAt),
                      _AiBubble(
                        message: state.messages[i],
                        onContinue:
                            state.messages[i].incomplete &&
                                i == state.messages.length - 1 &&
                                !state.typing
                            ? () => context.read<AiCubit>().ask(
                                'Tiếp tục câu trả lời chưa hoàn chỉnh ngay trước đó, từ phần đang dang dở.',
                              )
                            : null,
                        onRetry:
                            state.messages[i].status == AiMessageStatus.failed
                            ? () => context.read<AiCubit>().retry()
                            : null,
                      ),
                    ],
                    if (state.typing) const _TypingBubble(),
                    if (state.error != null)
                      _ErrorNotice(
                        message: state.error!,
                        onRetry: () => context.read<AiCubit>().retry(),
                      ),
                  ],
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
                      onSubmitted: _ask,
                      decoration: InputDecoration(
                        hintText: 'Hỏi trợ lý về chuyến đi…',
                        counterText: '',
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  BlocBuilder<AiCubit, AiState>(
                    builder: (context, state) => IconButton.filled(
                      tooltip: 'Gửi',
                      onPressed: state.typing ? null : () => _ask(_input.text),
                      icon: const Icon(Icons.send_rounded),
                    ),
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

class _Welcome extends StatelessWidget {
  final ValueChanged<String> onPick;
  const _Welcome({required this.onPick});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 24),
        const Icon(
          Icons.auto_awesome_rounded,
          size: 48,
          color: AppColors.primary,
        ),
        const SizedBox(height: 12),
        const Text(
          'Xin chào! Mình là trợ lý du lịch Tripri.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        const Text(
          'Hỏi mình về lịch trình, thời tiết hoặc kinh nghiệm chuẩn bị cho chuyến đi.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 20),
        for (final s in _suggestions)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(
              onPressed: () => onPick(s),
              child: Text(s, textAlign: TextAlign.center),
            ),
          ),
      ],
    );
  }
}

bool _isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

Widget _buildDateChip(DateTime date) {
  final now = DateTime.now();
  final isToday =
      date.year == now.year && date.month == now.month && date.day == now.day;
  final yesterday = now.subtract(const Duration(days: 1));
  final isYesterday =
      date.year == yesterday.year &&
      date.month == yesterday.month &&
      date.day == yesterday.day;

  String label;
  if (isToday) {
    label = 'Hôm nay';
  } else if (isYesterday) {
    label = 'Hôm qua';
  } else if (date.year == now.year) {
    label = DateFormat('dd/MM').format(date);
  } else {
    label = DateFormat('dd/MM/yyyy').format(date);
  }

  return Center(
    child: Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFF64748B),
        ),
      ),
    ),
  );
}

String _aiStatusLabel(AiMessageStatus s) => switch (s) {
  AiMessageStatus.sending => 'Đang gửi…',
  AiMessageStatus.sent => 'Đã gửi',
  AiMessageStatus.delivered => 'Đã nhận',
  AiMessageStatus.read => 'Đã xem',
  AiMessageStatus.failed => 'Lỗi · Chạm để thử lại',
};

Widget _buildAiStatusIcon(AiMessageStatus s) => switch (s) {
  AiMessageStatus.sending => const SizedBox(
    width: 10,
    height: 10,
    child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white70),
  ),
  AiMessageStatus.sent => const Icon(
    Icons.check_rounded,
    size: 13,
    color: Colors.white70,
  ),
  AiMessageStatus.delivered => const Icon(
    Icons.done_all_rounded,
    size: 14,
    color: Colors.white70,
  ),
  AiMessageStatus.read => const Icon(
    Icons.done_all_rounded,
    size: 14,
    color: Color(0xFF67E8F9),
  ),
  AiMessageStatus.failed => const Icon(
    Icons.error_outline_rounded,
    size: 13,
    color: Colors.amberAccent,
  ),
};

class _AiBubble extends StatelessWidget {
  final VoidCallback? onContinue;
  final AiMessage message;
  final VoidCallback? onRetry;
  const _AiBubble({required this.message, this.onRetry, this.onContinue});

  @override
  Widget build(BuildContext context) {
    final mine = message.role == AiRole.user;
    final timeStr = DateFormat('HH:mm').format(message.createdAt);
    final isFailed = message.status == AiMessageStatus.failed;

    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onTap: isFailed ? onRetry : null,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.82,
          ),
          decoration: BoxDecoration(
            gradient: mine
                ? const LinearGradient(
                    colors: [Color(0xFF0D9488), Color(0xFF0F766E)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            color: mine ? null : Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(18),
              topRight: const Radius.circular(18),
              bottomLeft: Radius.circular(mine ? 18 : 4),
              bottomRight: Radius.circular(mine ? 4 : 18),
            ),
            border: mine
                ? null
                : Border.all(color: const Color(0xFFE2E8F0), width: 1.1),
            boxShadow: [
              BoxShadow(
                color: mine
                    ? const Color(0x180D9488)
                    : Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: mine
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (mine)
                SelectableText(
                  message.content,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    height: 1.4,
                  ),
                )
              else
                MarkdownBody(
                  data: message.content,
                  selectable: true,
                  styleSheet: MarkdownStyleSheet(
                    p: const TextStyle(
                      color: Color(0xFF1E293B),
                      fontSize: 14.5,
                      height: 1.45,
                    ),
                    strong: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                      fontSize: 14.5,
                    ),
                    em: const TextStyle(
                      fontStyle: FontStyle.italic,
                      color: Color(0xFF334155),
                    ),
                    h1: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                      height: 1.35,
                    ),
                    h2: const TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                      height: 1.35,
                    ),
                    h3: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                    listBullet: const TextStyle(
                      fontSize: 14,
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                    ),
                    listIndent: 18,
                    blockSpacing: 8,
                    code: TextStyle(
                      backgroundColor: Colors.grey.shade100,
                      fontFamily: 'monospace',
                      fontSize: 13,
                      color: const Color(0xFF0F172A),
                    ),
                    codeblockDecoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                  ),
                ),
              if (message.incomplete)
                const Text(
                  'Câu trả lời chưa hoàn chỉnh.',
                  style: TextStyle(fontSize: 12),
                ),
              if (onContinue != null)
                TextButton(
                  onPressed: onContinue,
                  child: const Text('Tiếp tục tạo...'),
                ),
              const SizedBox(height: 6),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!mine) ...[
                    const Icon(
                      Icons.auto_awesome,
                      size: 12,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Trợ lý AI · $timeStr',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ] else ...[
                    Text(
                      '$timeStr · ${_aiStatusLabel(message.status)}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: isFailed
                            ? Colors.redAccent.shade100
                            : Colors.white70,
                      ),
                    ),
                    const SizedBox(width: 4),
                    _buildAiStatusIcon(message.status),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ba chấm nhấp nháy khi bot đang soạn câu trả lời (AC3).
class _TypingBubble extends StatefulWidget {
  const _TypingBubble();

  @override
  State<_TypingBubble> createState() => _TypingBubbleState();
}

class _TypingBubbleState extends State<_TypingBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        key: const Key('ai-typing'),
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1.1),
        ),
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) => Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < 3; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: Opacity(
                    opacity:
                        0.25 +
                        0.75 *
                            ((_c.value * 3 - i).clamp(0.0, 1.0) *
                                (1 - ((_c.value * 3 - i - 1).clamp(0.0, 1.0)))),
                    child: const CircleAvatar(
                      radius: 4,
                      backgroundColor: AppColors.textSecondary,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorNotice extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorNotice({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('ai-error'),
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.errorLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error),
          const SizedBox(width: 8),
          Expanded(child: Text(message)),
          TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    );
  }
}
