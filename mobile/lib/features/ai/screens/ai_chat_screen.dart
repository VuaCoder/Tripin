import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
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
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trợ lý AI', style: TextStyle(fontWeight: FontWeight.bold))),
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
                  padding: const EdgeInsets.all(12),
                  children: [
                    for (final m in state.messages) _AiBubble(message: m),
                    if (state.typing) const _TypingBubble(),
                    if (state.error != null)
                      _ErrorNotice(message: state.error!, onRetry: () => context.read<AiCubit>().retry()),
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
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
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
        const Icon(Icons.auto_awesome_rounded, size: 48, color: AppColors.primary),
        const SizedBox(height: 12),
        const Text('Xin chào! Mình là trợ lý du lịch Tripri.',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Hỏi mình về lịch trình, thời tiết hoặc kinh nghiệm chuẩn bị cho chuyến đi.',
            textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary)),
        const SizedBox(height: 20),
        for (final s in _suggestions)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(onPressed: () => onPick(s), child: Text(s, textAlign: TextAlign.center)),
          ),
      ],
    );
  }
}

class _AiBubble extends StatelessWidget {
  final AiMessage message;
  const _AiBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final mine = message.role == AiRole.user;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        decoration: BoxDecoration(
          color: mine ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: mine ? null : Border.all(color: AppColors.border),
        ),
        // Văn bản thuần: không dựng HTML từ nội dung của mô hình.
        child: SelectableText(
          message.content,
          style: TextStyle(color: mine ? Colors.white : AppColors.textPrimary, height: 1.4),
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

class _TypingBubbleState extends State<_TypingBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();

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
          border: Border.all(color: AppColors.border),
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
                    opacity: 0.25 + 0.75 * ((_c.value * 3 - i).clamp(0.0, 1.0) * (1 - ((_c.value * 3 - i - 1).clamp(0.0, 1.0)))),
                    child: const CircleAvatar(radius: 4, backgroundColor: AppColors.textSecondary),
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
      decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(12)),
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
